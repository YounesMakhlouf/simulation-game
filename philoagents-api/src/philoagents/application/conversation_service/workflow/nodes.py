from langchain_core.messages import RemoveMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode

from philoagents.application.conversation_service.workflow.chains import (
    get_character_response_chain,
    get_context_summary_chain,
    get_conversation_summary_chain,
)
from philoagents.application.conversation_service.workflow.state import (
    ConversationState,
)
from philoagents.application.conversation_service.workflow.tools import tools
from philoagents.config import settings

retriever_node = ToolNode(tools)


async def conversation_node(state: ConversationState, config: RunnableConfig):
    """
    The main conversational node. It invokes the core character response chain
    to generate a reply based on the current state.
    """
    summary = state.get("summary", "")
    conversation_chain = get_character_response_chain()

    response = await conversation_chain.ainvoke(
        {
            "messages": state["messages"],
            "sender_id": state["sender_id"],
            "retrieved_context": state.get("retrieved_context", ""),
            "character_name": state["character_name"],
            "character_perspective": state["character_perspective"],
            "character_style": state["character_style"],
            "character_goals": state["character_goals"],
            "character_resources": state["character_resources"],
            "character_statuses": state["character_statuses"],
            "known_intel": "\n".join(state["known_intel"]) or "None.",
            "crisis_update": state["crisis_update"],
            "negotiation_summaries": state["negotiation_summaries"],
            "summary": summary,
        },
        config,
    )

    return {"messages": response}


async def summarize_conversation_node(state: ConversationState):
    """
    Summarizes a long conversation to keep the context window manageable.
    """
    summary = state.get("summary", "")
    summary_chain = get_conversation_summary_chain(summary)

    response = await summary_chain.ainvoke(
        {
            "messages": state["messages"],
            "character_name": state["character_name"],
            "summary": summary,
        }
    )

    delete_messages = [
        RemoveMessage(id=m.id)
        for m in state["messages"][: -settings.TOTAL_MESSAGES_AFTER_SUMMARY]
    ]
    return {"summary": response.text, "messages": delete_messages}


async def summarize_context_node(state: ConversationState):
    """
    Summarizes the factual context retrieved from the RAG tool. This is useful
    if the retrieved documents are very long.
    """
    tool_output_message = state["messages"][-1]
    # Keep source passages for evaluation even when summaries remove tool messages.
    passages = []
    for message in reversed(state["messages"]):
        if not isinstance(message, ToolMessage):
            break
        passages[0:0] = message.artifact or []
    if not tool_output_message.text.strip():
        tool_output_message.content = "No relevant historical facts were found."
        return {"retrieved_passages": passages}
    context_summary_chain = get_context_summary_chain()

    response = await context_summary_chain.ainvoke(
        {
            "context": tool_output_message.text,
        }
    )
    tool_output_message.content = response.text

    return {"retrieved_passages": passages}


async def connector_node(state: ConversationState):
    return {}
