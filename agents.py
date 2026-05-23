import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_tavily import TavilySearch
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from state import NewsletterState, EditorDecision
load_dotenv()

# Shared LLM instance — all agents use this
llm = ChatAnthropic(model="claude-sonnet-4-20250514")

# Tavily search tool
search_tool = TavilySearch(max_results=4)


# ── Researcher Agent ──────────────────────────────────────────
def researcher_agent(state):
    print("\n Researcher working...")

    # Search the web for the topic
    search_results = search_tool.invoke(state.topic)

    # Ask the LLM to summarise the raw search results
    messages = [
        SystemMessage(content="""You are a research assistant. 
        Given raw search results, extract and summarise the most relevant 
        and interesting facts, stats, and insights. Be thorough but concise.
        Format as clear bullet points."""),
        HumanMessage(content=f"""
        Topic: {state.topic}

        Search results:
        {search_results}

        Summarise the key findings for a newsletter writer to use.
        """)
    ]

    response = llm.invoke(messages)

    print("Research complete")
    return {
        "research": response.content,
        "next_agent": "writer",
        "status": "writing"
    }

# ── Writer Agent ──────────────────────────────────────────────
def writer_agent(state):
    print(" Writer working...")

    # If there's feedback from the editor, revise the draft
    # Otherwise write a fresh draft from research
    if state.feedback:
        prompt = f"""
        You are a newsletter writer. Revise the draft based on the editor's feedback.

        Original draft:
        {state.draft}

        Editor feedback:
        {state.feedback}

        Write an improved version addressing all feedback points.
        """
    else:
        prompt = f"""
        You are a newsletter writer. Write an engaging newsletter based on this research.

        Topic: {state.topic}

        Research:
        {state.research}

        Format the newsletter with:
        - A catchy subject line
        - A short intro (2-3 sentences)
        - 3 main sections with headers
        - A closing takeaway

        Write in a clear, engaging tone for a tech-savvy audience.
        """

    messages = [
        SystemMessage(content="You are an expert newsletter writer known for clear, engaging writing."),
        HumanMessage(content=prompt)
    ]

    response = llm.invoke(messages)

    print("Draft complete")
    return {
        "draft": response.content,
        "feedback": "",        # clear old feedback after revision
        "next_agent": "editor",
        "status": "editing"
    }

# ── Editor Agent ──────────────────────────────────────────────
def editor_agent(state):
    print(" Editor reviewing...")

    # Bind structured output to the LLM
    structured_llm = llm.with_structured_output(EditorDecision)

    messages = [
        SystemMessage(content="""You are a sharp newsletter editor. 
        Review drafts for clarity, structure, engagement, and accuracy.
        Be constructive but demanding — only approve truly strong drafts."""),
        HumanMessage(content=f"""
        Review this newsletter draft on the topic: {state.topic}

        Draft:
        {state.draft}

        Criteria:
        - Clear and engaging subject line
        - Strong intro that hooks the reader
        - Well-structured sections with useful content
        - Actionable closing takeaway
        - Appropriate tone for a tech-savvy audience

        Decide: approve or revise?
        If revising, give specific actionable feedback.
        """)
    ]

    decision = structured_llm.invoke(messages)

    print(f"   Decision: {decision.decision.upper()}")
    print(f"   Reason: {decision.reason}")

    if decision.decision == "approve":
        return {
            "status": "approved",
            "next_agent": "end",
        }
    else:
        # Cap revisions at 2 to avoid infinite loops
        new_revision_count = state.revision_count + 1
        if new_revision_count >= 2:
            print("   ⚠️  Max revisions reached — approving as-is")
            return {
                "status": "approved",
                "next_agent": "end",
                "revision_count": new_revision_count
            }

        print(f"   Feedback: {decision.feedback}")
        return {
            "feedback": decision.feedback,
            "revision_count": new_revision_count,
            "next_agent": "writer",
            "status": "writing"
        }