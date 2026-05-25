from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from state import NewsletterState
from agents import researcher_agent, writer_agent, editor_agent
from supervisor import supervisor_node, route


def build_graph():
    # 1. Initialize graph with our state
    builder = StateGraph(NewsletterState)

    # 2. Add all nodes
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_agent)
    builder.add_node("writer", writer_agent)
    builder.add_node("editor", editor_agent)

    # 3. Entry point — always start at supervisor
    builder.set_entry_point("supervisor")

    # 4. Supervisor routes to agents via conditional edge
    builder.add_conditional_edges(
        "supervisor",
        route,
        {
            "researcher": "researcher",
            "writer":     "writer",
            "editor":     "editor",
            "end":        END
        }
    )

    # 5. Every agent returns to supervisor after finishing
    builder.add_edge("researcher", "supervisor")
    builder.add_edge("writer",     "supervisor")
    builder.add_edge("editor",     "supervisor")
    checkpointer=MemorySaver()

    return builder.compile(checkpointer=checkpointer)


graph = build_graph()