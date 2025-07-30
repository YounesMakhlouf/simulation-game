from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from philoagents.application.game_loop_service.workflow.nodes import (
    action_decision_node,
    resolution_node,
)
from philoagents.application.game_loop_service.workflow.state import (
    ActionState,
    ResolutionState,
)

# --- Delegate Action Agent Graph ---


@lru_cache(maxsize=1)
def create_action_graph():
    """
    Creates and compiles the LangGraph workflow for the Delegate Action Agent.

    This is a simple, single-step graph. Its only purpose is to take the
    current game context and generate a single, structured `Action` object
    from the perspective of a specific character.

    Returns:
        A compiled StateGraph instance for the action agent.
    """
    graph_builder = StateGraph(ActionState)

    # Add the single decision-making node
    graph_builder.add_node("action_decision_node", action_decision_node)

    # Define the simple flow: start, make a decision, and end.
    graph_builder.add_edge(START, "action_decision_node")
    graph_builder.add_edge("action_decision_node", END)

    return graph_builder


# --- AI Judge Agent Graph ---


@lru_cache(maxsize=1)
def create_judge_graph():
    """
    Creates and compiles the LangGraph workflow for the AI Judge Agent.

    This is also a single-step graph. It takes all submitted actions for the
    round and the secret undergame plot, resolving them into a new crisis update
    and a list of updated character resources.

    Returns:
        A compiled StateGraph instance for the judge agent.
    """
    graph_builder = StateGraph(ResolutionState)

    # Add the single resolution node
    graph_builder.add_node("resolution_node", resolution_node)

    # Define the simple flow: start, resolve the round, and end.
    graph_builder.add_edge(START, "resolution_node")
    graph_builder.add_edge("resolution_node", END)

    return graph_builder


# Compiled without a checkpointer. Used for LangGraph Studio
action_agent_graph = create_action_graph().compile()
judge_agent_graph = create_judge_graph().compile()
