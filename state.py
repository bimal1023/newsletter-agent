from pydantic import BaseModel, Field
from typing import Annotated
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