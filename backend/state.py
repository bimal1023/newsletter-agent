from pydantic import BaseModel, Field
from typing import Annotated, Literal
import operator


class NewsletterState(BaseModel):
    # Input
    topic: str

    # Research phase
    research: str = ""

    # Writing phase
    draft: str = ""

    # Editing phase
    feedback: str = ""
    revision_count: int = 0

    # Supervisor routing
    next_agent: str = "researcher"
    status: str = "researching"

    covered_topics:list[str]= Field(default_factory=list)



# Structured output model for the Editor's decision
class EditorDecision(BaseModel):
    decision: Literal["approve", "revise"]
    feedback: str = Field(
        description="If revising, specific feedback for the writer. Empty if approving."
    )
    reason: str = Field(
        description="Brief explanation of the decision."
    )