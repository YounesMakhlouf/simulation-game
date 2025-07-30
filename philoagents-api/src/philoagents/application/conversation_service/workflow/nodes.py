from langchain_core.messages import RemoveMessage
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
            "retrieved_context": state.get("retrieved_context", ""),
            "character_name": state["character_name"],
            "character_perspective": state["character_perspective"],
            "character_style": state["character_style"],
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
    return {"summary": response.content, "messages": delete_messages}


async def summarize_context_node(state: ConversationState):
    """
    Summarizes the factual context retrieved from the RAG tool. This is useful
    if the retrieved documents are very long.
    """
    context_summary_chain = get_context_summary_chain()
    tool_output_message = state["messages"][-1]

    response = await context_summary_chain.ainvoke(
        {
            "context": tool_output_message.content,
        }
    )
    tool_output_message.content = response.content

    return {}


async def connector_node(state: ConversationState):
    return {}
