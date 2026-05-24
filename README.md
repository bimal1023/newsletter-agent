# Newsletter Agent

A multi-agent AI pipeline that researches any topic on the web, writes a polished newsletter, and self-edits until it's good enough — served through a clean web UI.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-agent%20framework-blueviolet?style=flat)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204-orange?style=flat)

---

## What it does

You type a topic. Three AI agents take over:

1. **Researcher** — searches the live web (via Tavily) and summarises the best facts and insights
2. **Writer** — turns the research into a structured, engaging newsletter draft
3. **Editor** — reviews the draft and either approves it or sends it back with specific feedback

The writer and editor loop until the newsletter meets the bar — or until two revisions are done, whichever comes first.

---

## Agent Architecture

```
                        ┌─────────────┐
           topic ──────►│  Supervisor │◄─────────────────┐
                        └──────┬──────┘                  │
                               │ routes to                │
              ┌────────────────┼────────────────┐         │
              ▼                ▼                ▼         │
       ┌────────────┐  ┌─────────────┐  ┌───────────────┐│
       │ Researcher │  │   Writer    │  │    Editor     ││
       │            │  │             │  │               ││
       │ Tavily web │  │ Drafts from │  │ Approves  or  ││
       │ search +   │  │ research or │  │ sends feedback││
       │ LLM summary│  │ feedback    │  │ back to writer││
       └─────┬──────┘  └──────┬──────┘  └──────┬────────┘│
             │                │                 │         │
             └────────────────┴─────────────────┴─────────┘
                              returns to supervisor
```

Each agent writes its output into a shared `NewsletterState` object. The supervisor reads `next_agent` from state and routes accordingly — no hardcoded chains.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent framework | LangGraph |
| LLM | Claude Sonnet 4 (via LangChain Anthropic) |
| Web search | Tavily Search API |
| Backend API | FastAPI + Uvicorn |
| Frontend | Next.js 16 + TypeScript |
| Styling | Tailwind CSS + Typography plugin |
| Markdown rendering | react-markdown + remark-gfm |

---

## Project Structure

```
newsletter_agent/
├── backend/
│   ├── agents.py       # Researcher, Writer, Editor agent functions
│   ├── graph.py        # LangGraph graph wiring and compilation
│   ├── state.py        # NewsletterState and EditorDecision models
│   ├── supervisor.py   # Routing logic
│   ├── main.py         # FastAPI app (POST /generate)
│   ├── run.py          # CLI runner
│   └── requirements.txt
├── frontend/
│   └── app/
│       ├── page.tsx    # Main UI — input form + newsletter display
│       ├── layout.tsx
│       └── globals.css
├── .env                # API keys (never commit)
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+ with the `newsletter-agent` conda environment
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Tavily API key](https://tavily.com/)

### 1. Clone and configure

```bash
git clone https://github.com/bimal1023/newsletter-agent
cd newsletter_agent
```

Create a `.env` file in the root:

```env
ANTHROPIC_API_KEY=your_anthropic_key
TAVILY_API_KEY=your_tavily_key
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 9000
```

The API will be available at `http://localhost:9000`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## API

### `POST /generate`

Runs the full agent pipeline for a given topic.

**Request**
```json
{ "topic": "AI agents in 2026" }
```

**Response**
```json
{
  "draft": "# Subject: ...\n\n...",
  "revision_count": 1,
  "status": "approved"
}
```

---

## Key Concepts

**Shared state routing** — agents don't call each other directly. Each one writes `next_agent` into the state, and the supervisor reads it to decide who runs next. This makes the pipeline easy to extend.

**Structured output** — the Editor uses `llm.with_structured_output(EditorDecision)` to return a typed `approve/revise` decision with specific feedback, not free text. This makes the routing logic reliable.

**Revision cap** — the writer/editor loop is capped at 2 revisions to prevent infinite cycles. If the limit is hit, the current draft is approved as-is.
