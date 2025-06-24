from typing import List, Optional, Annotated

from langgraph.graph.message import add_messages, AnyMessage
from typing_extensions import TypedDict


class ConversationState(TypedDict):
    """
    State class for the conversation_service LangGraph workflow.

    This class manages the context for a single character who is participating
    in a private, one-on-one conversation. It holds all the information necessary
    for that character to generate a believable, in-character response to a message.

    Attributes:
        messages: A list of messages in the current conversation thread.
                  Managed by LangGraph's `add_messages`.
        character_id: The unique ID of the character whose state this is.
        character_name: The full name of the character.
        character_perspective: The character's worldview and political beliefs.
        character_style: The character's conversational and diplomatic style.
        retrieved_context: Factual context retrieved from the RAG system to
                           ground the conversation.
        summary: A running summary of the conversation to manage token count.
    """
    messages: Annotated[List[AnyMessage], add_messages]
    character_id: str
    character_name: str
    character_perspective: str
    character_style: str
    retrieved_context: Optional[str]
    summary: Optional[str]


def state_to_str(state: ConversationState) -> str:
    """
    A utility function to create a string representation of the conversation state,
    useful for debugging and logging.
    """
    # Prefer showing the summary if it exists, otherwise show the raw messages.
    if "summary" in state and state["summary"]:
        conversation_history = f"Summary: '{state['summary']}'"
    elif "messages" in state and state["messages"]:
        # Format messages for readability
        formatted_messages = "\n  ".join([f"{m.type.capitalize()}: {m.content}" for m in state["messages"]])
        conversation_history = f"Messages:\n  {formatted_messages}"
    else:
        conversation_history = "No conversation history."

    # Handle optional retrieved_context
    retrieved_info = state.get("retrieved_context", "None")

    return f"""
--- Conversation State ---
Character: {state.get('character_name', 'N/A')} (ID: {state.get('character_id', 'N/A')})
Perspective: {state.get('character_perspective', 'N/A')[:80]}...
Style: {state.get('character_style', 'N/A')[:80]}...
Retrieved Context: {retrieved_info[:100]}...
{conversation_history}
------------------------
"""
