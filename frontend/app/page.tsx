"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Stage = "idle" | "researching" | "writing" | "editing" | "done";

const STAGE_LABELS: Record<Stage, string> = {
  idle: "",
  researching: "Researching the topic...",
  writing: "Writing the newsletter...",
  editing: "Editor reviewing the draft...",
  done: "",
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [draft, setDraft] = useState("");
  const [revisions, setRevisions] = useState(0);
  const [error, setError] = useState("");

  async function generate() {
    if (!topic.trim()) return;
    setError("");
    setDraft("");
    setStage("researching");

    const stages: Stage[] = ["researching", "writing", "editing"];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % stages.length;
      setStage(stages[i]);
    }, 3500);

    try {
      const res = await fetch("http://localhost:9000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      clearInterval(timer);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong");
      }

      const data = await res.json();
      setDraft(data.draft);
      setRevisions(data.revision_count);
      setStage("done");
    } catch (e: unknown) {
      clearInterval(timer);
      setStage("idle");
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Newsletter Agent</h1>
        <p className="text-zinc-400 text-sm">
          Multi-agent AI that researches, writes, and edits a newsletter for you.
        </p>
      </div>

      <div className="w-full max-w-2xl flex gap-2 mb-10">
        <input
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder="e.g. AI agents in 2026, quantum computing breakthroughs..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && stage === "idle" && generate()}
          disabled={stage !== "idle" && stage !== "done"}
        />
        <button
          onClick={generate}
          disabled={!topic.trim() || (stage !== "idle" && stage !== "done")}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
        >
          Generate
        </button>
      </div>

      {stage !== "idle" && stage !== "done" && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center gap-3 text-zinc-400 text-sm mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            {STAGE_LABELS[stage]}
          </div>
          <Pipeline stage={stage} />
        </div>
      )}

      {error && (
        <div className="w-full max-w-2xl mb-6 bg-red-950 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {draft && (
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-zinc-500">
              {revisions === 0
                ? "Approved on first draft"
                : `${revisions} revision${revisions > 1 ? "s" : ""} made`}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(draft)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-li:text-zinc-300 prose-strong:text-zinc-100 prose-hr:border-zinc-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
          </div>
        </div>
      )}
    </main>
  );
}

function Pipeline({ stage }: { stage: Stage }) {
  const steps = [
    { key: "researching", label: "Researcher" },
    { key: "writing", label: "Writer" },
    { key: "editing", label: "Editor" },
  ];

  const activeIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all duration-500 ${
              i === activeIndex
                ? "border-indigo-500 bg-indigo-950 text-indigo-300"
                : i < activeIndex
                ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                : "border-zinc-800 bg-zinc-900 text-zinc-600"
            }`}
          >
            {i < activeIndex ? "✓ " : i === activeIndex ? "⟳ " : ""}
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < activeIndex ? "bg-zinc-600" : "bg-zinc-800"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
