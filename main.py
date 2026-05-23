from graph import graph

def run(topic: str):
    print(f" Generating newsletter on: {topic}")
    print("=" * 50)

    result = graph.invoke(
        {"topic": topic},
        {"recursion_limit": 25}
    )

    print("\n" + "=" * 50)
    print("Newsletter complete!")
    print(f"   Revisions: {result.get('revision_count', 0)}")
    print("FINAL NEWSLETTER")
    print("=" * 50)
    print(result.get("draft", ""))


if __name__ == "__main__":
    run("AI agents in 2026")