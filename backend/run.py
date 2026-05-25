from graph import graph


def run(topic: str, thread_id: str = "default-session"):
    print(f"Generating newsletter on: {topic}")
    print(f"   Session: {thread_id}")
    print("=" * 50)

    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 25}

    result = graph.invoke({"topic": topic}, config)

    print("\n" + "=" * 50)
    print("Newsletter complete!")
    print(f"   Revisions: {result.get('revision_count', 0)}")
    print(f"   Topics covered this session: {result.get('covered_topics', [])}")
    print("FINAL NEWSLETTER")
    print("=" * 50)
    print(result.get("draft", ""))


if __name__ == "__main__":
    run("AI agents in 2026", thread_id="bimal-session-1")