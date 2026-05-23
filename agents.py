import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_tavily import TavilySearch
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage

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
    