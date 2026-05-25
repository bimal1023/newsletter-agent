"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Stage = "idle" | "researching" | "writing" | "editing" | "done";

interface HistoryItem {
  id: number;
  topic: string;
  draft: string;
  revision_count: number;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + " UTC");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [draft, setDraft] = useState("");
  const [revisions, setRevisions] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const res = await fetch("http://localhost:9000/history");
      if (res.ok) setHistory(await res.json());
    } catch {
      // History is optional
    }
  }

  function loadFromHistory(item: HistoryItem) {
    setDraft(item.draft);
    setRevisions(item.revision_count);
    setCurrentTopic(item.topic);
    setTopic(item.topic);
    setStage("done");
    setActiveId(item.id);
    setError("");
    setEditInstruction("");
  }

  function newNewsletter() {
    setDraft("");
    setStage("idle");
    setTopic("");
    setCurrentTopic("");
    setActiveId(null);
    setError("");
    setRevisions(0);
    setEditInstruction("");
  }

  async function generate() {
    if (!topic.trim() || isGenerating) return;
    setError("");
    setDraft("");
    setActiveId(null);
    setEditInstruction("");
    setCurrentTopic(topic.trim());
    setStage("researching");

    try {
      const res = await fetch("http://localhost:9000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Generation failed");
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by double newlines
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (data.type === "stage") {
              setStage(data.stage as Stage);
            } else if (data.type === "done") {
              setDraft(data.draft);
              setRevisions(data.revision_count);
              setStage("done");
              await loadHistory();
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (e: unknown) {
      setStage("idle");
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }

  async function applyEdit() {
    if (!editInstruction.trim() || isEditing) return;
    setIsEditing(true);
    setError("");

    try {
      const res = await fetch("http://localhost:9000/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, instruction: editInstruction.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Edit failed");
      }

      const data = await res.json();
      setDraft(data.draft);
      setEditInstruction("");
      editInputRef.current?.focus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setIsEditing(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadMarkdown() {
    const blob = new Blob([draft], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTopic.slice(0, 40).replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isGenerating = stage !== "idle" && stage !== "done";

  return (
    <div className="flex flex-col h-screen bg-[#09090b] text-[#fafafa] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1f1f23] flex-shrink-0 bg-[#0d0d10]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">Newsletter Agent</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#27272a] text-[#71717a] leading-none">Beta</span>
        </div>
        <div className="flex items-center gap-4">
          {(draft || isGenerating) && (
            <button
              onClick={newNewsletter}
              className="text-xs text-[#71717a] hover:text-[#fafafa] transition-colors font-medium"
            >
              + New
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-[#52525b]">Connected</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-[#1f1f23] flex flex-col flex-shrink-0 bg-[#0a0a0d]">
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-widest">History</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="px-4 py-10 flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <p className="text-[11px] text-[#3f3f46] text-center leading-tight">
                  Generated newsletters<br />will appear here
                </p>
              </div>
            ) : (
              <div className="py-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className={`w-full text-left px-4 py-2.5 transition-all hover:bg-[#18181b] border-l-2 ${
                      activeId === item.id
                        ? "bg-[#18181b] border-l-violet-500"
                        : "border-l-transparent"
                    }`}
                  >
                    <p className={`text-[13px] truncate leading-tight font-medium ${
                      activeId === item.id ? "text-[#fafafa]" : "text-[#a1a1aa]"
                    }`}>
                      {item.topic}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-[#3f3f46]">{formatDate(item.created_at)}</span>
                      {item.revision_count > 0 && (
                        <span className="text-[11px] text-[#3f3f46]">· {item.revision_count}r</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">

            {/* Topic input */}
            <div className="flex gap-2.5 mb-8">
              <input
                className="flex-1 bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-3 text-sm text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/60 disabled:opacity-50 transition-all"
                placeholder="e.g. AI breakthroughs in 2026, quantum computing..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isGenerating && generate()}
                disabled={isGenerating}
              />
              <button
                onClick={generate}
                disabled={!topic.trim() || isGenerating}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                {isGenerating ? "Generating…" : "Generate"}
              </button>
            </div>

            {/* Real-time agent pipeline */}
            {isGenerating && (
              <div className="mb-8">
                <AgentPipeline stage={stage} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-6 bg-red-950/40 border border-red-900/40 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Empty state */}
            {stage === "idle" && !draft && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[#52525b]">Ready to write</p>
                <p className="text-xs text-[#3f3f46] mt-1.5 max-w-xs leading-relaxed">
                  Enter a topic above — our AI agents will research, write, and edit a full newsletter.
                </p>
              </div>
            )}

            {/* Newsletter output */}
            {draft && stage === "done" && (
              <div>
                {/* Title */}
                <h1 className="text-xl font-semibold text-[#fafafa] leading-snug mb-5">
                  {currentTopic}
                </h1>

                {/* Meta bar */}
                <div className="flex items-center justify-between mb-6 pb-5 border-b border-[#1f1f23]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#52525b] bg-[#18181b] border border-[#27272a] px-2.5 py-1 rounded-lg">
                      {wordCount(draft).toLocaleString()} words
                    </span>
                    <span className="text-[11px] text-[#52525b] bg-[#18181b] border border-[#27272a] px-2.5 py-1 rounded-lg">
                      {revisions === 0 ? "First draft approved" : `${revisions} revision${revisions !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={downloadMarkdown}
                      className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#18181b]"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      .md
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#18181b]"
                    >
                      {copied ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Newsletter prose */}
                <div className="prose prose-invert prose-sm max-w-none
                  prose-headings:font-semibold prose-headings:text-[#fafafa] prose-headings:tracking-tight
                  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                  prose-p:text-[#a1a1aa] prose-p:leading-7
                  prose-li:text-[#a1a1aa] prose-li:leading-7
                  prose-strong:text-[#e4e4e7] prose-strong:font-semibold
                  prose-hr:border-[#27272a] prose-hr:my-8
                  prose-blockquote:border-l-2 prose-blockquote:border-l-violet-500 prose-blockquote:text-[#71717a] prose-blockquote:not-italic
                  prose-code:text-violet-300 prose-code:bg-[#18181b] prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
                  prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-[#27272a] prose-pre:rounded-xl
                  prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                </div>

                {/* Edit section */}
                <div className="mt-10 pt-6 border-t border-[#1f1f23]">
                  <p className="text-xs text-[#52525b] mb-3 font-medium uppercase tracking-widest">Request a change</p>
                  <div className="flex gap-2.5">
                    <input
                      ref={editInputRef}
                      className="flex-1 bg-[#18181b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-[#fafafa] placeholder-[#3f3f46] focus:outline-none focus:ring-1 focus:ring-violet-500/60 focus:border-violet-500/60 disabled:opacity-50 transition-all"
                      placeholder="e.g. Make the intro shorter, add a section about X..."
                      value={editInstruction}
                      onChange={(e) => setEditInstruction(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !isEditing && applyEdit()}
                      disabled={isEditing}
                    />
                    <button
                      onClick={applyEdit}
                      disabled={!editInstruction.trim() || isEditing}
                      className="bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] disabled:opacity-40 disabled:cursor-not-allowed text-[#a1a1aa] hover:text-[#fafafa] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                    >
                      {isEditing ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                          Applying…
                        </span>
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function AgentPipeline({ stage }: { stage: Stage }) {
  const steps = [
    { key: "researching", label: "Researcher", desc: "Gathering information and sources" },
    { key: "writing",     label: "Writer",     desc: "Crafting the newsletter draft" },
    { key: "editing",     label: "Editor",     desc: "Reviewing and polishing" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const status = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        return (
          <div
            key={step.key}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-xl border transition-all duration-500 ${
              status === "active"  ? "bg-violet-950/20 border-violet-800/30" :
              status === "done"   ? "bg-[#18181b] border-[#27272a]" :
                                    "bg-[#111113] border-[#1a1a1d]"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
              status === "pending" ? "bg-[#27272a]" : "bg-violet-600"
            }`}>
              {status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : status === "active" ? (
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              ) : (
                <span className="text-[10px] font-medium text-[#52525b]">{i + 1}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium transition-colors ${
                status === "active"  ? "text-violet-300" :
                status === "done"   ? "text-[#52525b]"  :
                                      "text-[#3f3f46]"
              }`}>
                {step.label}
              </p>
              {status === "active" && (
                <p className="text-xs text-[#52525b] mt-0.5">{step.desc}</p>
              )}
            </div>

            {status === "done" && (
              <span className="text-xs text-[#52525b]">Done</span>
            )}
            {status === "active" && (
              <div className="flex gap-0.5 flex-shrink-0">
                <div className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
                <div className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
                <div className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
