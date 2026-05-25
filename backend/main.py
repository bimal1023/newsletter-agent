from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from graph import graph
from agents import llm
from langchain_core.messages import HumanMessage, SystemMessage
import sqlite3
import uuid
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_db = sqlite3.connect("memory.db", check_same_thread=False)
_db.execute("""
    CREATE TABLE IF NOT EXISTS newsletters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        draft TEXT NOT NULL,
        revision_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )
""")
_db.commit()


class GenerateRequest(BaseModel):
    topic: str


class EditRequest(BaseModel):
    draft: str
    instruction: str


@app.post("/generate")
def generate(req: GenerateRequest):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    thread_id = str(uuid.uuid4())
    topic = req.topic.strip()

    def event_stream():
        # Signal the frontend to show researcher as active immediately
        yield f"data: {json.dumps({'type': 'stage', 'stage': 'researching'})}\n\n"

        final_draft = ""
        final_revision_count = 0

        for event in graph.stream(
            {"topic": topic},
            {"configurable": {"thread_id": thread_id}, "recursion_limit": 25},
            stream_mode="updates",
        ):
            node_name = list(event.keys())[0]
            update = event[node_name]

            if node_name == "researcher":
                # Researcher finished → writer is next
                yield f"data: {json.dumps({'type': 'stage', 'stage': 'writing'})}\n\n"

            elif node_name == "writer":
                final_draft = update.get("draft", final_draft)
                # Writer finished → editor is next
                yield f"data: {json.dumps({'type': 'stage', 'stage': 'editing'})}\n\n"

            elif node_name == "editor":
                if "revision_count" in update:
                    final_revision_count = update["revision_count"]
                # Editor sent it back for revision → writer runs again
                if update.get("next_agent") == "writer":
                    yield f"data: {json.dumps({'type': 'stage', 'stage': 'writing'})}\n\n"

        if final_draft:
            _db.execute(
                "INSERT INTO newsletters (topic, draft, revision_count) VALUES (?, ?, ?)",
                (topic, final_draft, final_revision_count),
            )
            _db.commit()

        yield f"data: {json.dumps({'type': 'done', 'draft': final_draft, 'revision_count': final_revision_count})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/edit")
def edit_newsletter(req: EditRequest):
    messages = [
        SystemMessage(content=(
            "You are an expert newsletter editor. "
            "Apply the requested changes to the newsletter draft while maintaining "
            "its overall quality, structure, and tone."
        )),
        HumanMessage(content=f"""Here is the current newsletter draft:

{req.draft}

The user wants the following change:
{req.instruction}

Return the complete revised newsletter with the requested changes applied. Keep everything else unchanged."""),
    ]
    response = llm.invoke(messages)
    return {"draft": response.content}


@app.get("/history")
def get_history():
    rows = _db.execute(
        "SELECT id, topic, draft, revision_count, created_at FROM newsletters ORDER BY created_at DESC LIMIT 30"
    ).fetchall()
    return [
        {"id": r[0], "topic": r[1], "draft": r[2], "revision_count": r[3], "created_at": r[4]}
        for r in rows
    ]
