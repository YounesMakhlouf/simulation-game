import uuid
from typing import Any, AsyncGenerator, List, Union

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.checkpoint.mongodb.aio import AsyncMongoDBSaver
from opik.integrations.langchain import OpikTracer

from philoagents.application.conversation_service.workflow.graph import (
    create_workflow_graph,
)
from philoagents.application.conversation_service.workflow.state import (
    ConversationState,
)
from philoagents.config import settings
from philoagents.domain import Character


def __get_conversation_thread_id(
    sender_id: str, receiver_id: str, new_thread: bool
) -> str:
    """
    Generates a unique and consistent thread ID for a conversation between two characters.
    It sorts the IDs to ensure the thread ID is the same regardless of who initiates.
    """
    sorted_ids = sorted([sender_id, receiver_id])
    base_thread_id = f"conv-{sorted_ids[0]}-{sorted_ids[1]}"

    if new_thread:
        return f"{base_thread_id}-{uuid.uuid4()}"
    return base_thread_id


async def get_response(
    messages: Union[str, List[dict]],
    sender_id: str,
    receiver_character: Character,
    new_thread: bool = False,
) -> tuple[str, ConversationState]:
    """
    Runs a single turn of a conversation through the graph for a non-streaming response.

    Args:
        messages: The message(s) being sent.
        sender_id: The ID of the character sending the message.
        receiver_character: The fully instantiated Character object that is receiving
                            the message and will generate the response.
        new_thread: If True, creates a new, unique conversation thread.

    Returns:
        A tuple containing the string content of the final response and the
        final state of the conversation.
    """
    graph_builder = create_workflow_graph()

    try:
        async with AsyncMongoDBSaver.from_conn_string(
            conn_string=settings.MONGO_URI,
            db_name=settings.MONGO_DB_NAME,
            checkpoint_collection_name=settings.MONGO_STATE_CHECKPOINT_COLLECTION,
            writes_collection_name=settings.MONGO_STATE_WRITES_COLLECTION,
        ) as checkpointer:
            graph = graph_builder.compile(checkpointer=checkpointer)
            opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
            thread_id = __get_conversation_thread_id(
                sender_id, receiver_character.id, new_thread
            )
            config = {
                "configurable": {"thread_id": thread_id},
                "callbacks": [opik_tracer],
            }
            initial_state = {
                "messages": __format_messages(messages),
                "character_id": receiver_character.id,
                "character_name": receiver_character.name,
                "character_perspective": receiver_character.perspective,
                "character_style": receiver_character.style,
            }

            output_state = await graph.ainvoke(
                input=initial_state,
                config=config,
            )
        last_message = output_state["messages"][-1]
        return last_message.content, ConversationState(**output_state)
    except Exception as e:
        raise RuntimeError(f"Error running conversation workflow: {str(e)}") from e


async def get_streaming_response(
    messages: Union[str, List[dict]],
    sender_id: str,
    receiver_character: Character,
    new_thread: bool = False,
) -> AsyncGenerator[str, None]:
    """
    Runs a conversation through the graph with a streaming response.

    Args:
        messages: The message(s) being sent.
        sender_id: The ID of the character sending the message.
        receiver_character: The Character object that will generate the response.
        new_thread: If True, creates a new, unique conversation thread.

    Yields:
        Chunks of the response content as they become available.
    """
    graph_builder = create_workflow_graph()

    try:
        async with AsyncMongoDBSaver.from_conn_string(
            conn_string=settings.MONGO_URI,
            db_name=settings.MONGO_DB_NAME,
            checkpoint_collection_name=settings.MONGO_STATE_CHECKPOINT_COLLECTION,
            writes_collection_name=settings.MONGO_STATE_WRITES_COLLECTION,
        ) as checkpointer:
            graph = graph_builder.compile(checkpointer=checkpointer)
            opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
            thread_id = __get_conversation_thread_id(
                sender_id, receiver_character.id, new_thread
            )
            config = {
                "configurable": {"thread_id": thread_id},
                "callbacks": [opik_tracer],
            }
            initial_state = {
                "messages": __format_messages(messages),
                "character_id": receiver_character.id,
                "character_name": receiver_character.name,
                "character_perspective": receiver_character.perspective,
                "character_style": receiver_character.style,
            }
            async for chunk in graph.astream(
                input=initial_state,
                config=config,
                stream_mode="messages",
            ):
                if chunk[1]["langgraph_node"] == "conversation_node" and isinstance(
                    chunk[0], AIMessageChunk
                ):
                    yield chunk[0].content

    except Exception as e:
        raise RuntimeError(
            f"Error running streaming conversation workflow: {str(e)}"
        ) from e


def __format_messages(
    messages: Union[str, list[dict[str, Any]]],
) -> list[Union[HumanMessage, AIMessage]]:
    """Convert various message formats to a list of LangChain message objects.

    Args:
        messages: Can be one of:
            - A single string message
            - A list of string messages
            - A list of dictionaries with 'role' and 'content' keys

    Returns:
        List[Union[HumanMessage, AIMessage]]: A list of LangChain message objects
    """

    if isinstance(messages, str):
        return [HumanMessage(content=messages)]

    if isinstance(messages, list):
        if not messages:
            return []

        if (
            isinstance(messages[0], dict)
            and "role" in messages[0]
            and "content" in messages[0]
        ):
            result = []
            for msg in messages:
                if msg["role"] == "user":
                    result.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    result.append(AIMessage(content=msg["content"]))
            return result

        return [HumanMessage(content=message) for message in messages]

    return []
