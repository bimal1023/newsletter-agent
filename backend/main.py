from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph import graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    topic: str


class GenerateResponse(BaseModel):
    draft: str
    revision_count: int
    status: str


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    result = graph.invoke(
        {"topic": req.topic.strip()},
        {"recursion_limit": 25}
    )

    return GenerateResponse(
        draft=result.get("draft", ""),
        revision_count=result.get("revision_count", 0),
        status=result.get("status", "approved"),
    )
