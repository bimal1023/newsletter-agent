from state import NewsletterState


def supervisor_node(state: NewsletterState) -> dict:
    print(f" Supervisor checking state... (next: {state.next_agent})")
    # Supervisor doesn't do any LLM calls
    # It just reads next_agent from state and returns it
    # The graph uses this to decide where to route
    return {"next_agent": state.next_agent}


def route(state: NewsletterState) -> str:
    """This is what the conditional edge calls to decide routing."""
    return state.next_agent