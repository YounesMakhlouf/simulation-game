import asyncio
from contextlib import contextmanager, nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from test_game_loop_service import make_character

from philoagents.application.conversation_service import generate_response
from philoagents.application.conversation_service.workflow import nodes
from philoagents.application.conversation_service.workflow.state import state_to_str

BLOCKS = [
    {"type": "reasoning", "reasoning": "private reasoning"},
    {"type": "text", "text": "Hello "},
    {"type": "text", "text": "world"},
]


@pytest.mark.parametrize("content", ["Hello world", BLOCKS])
def test_response_extracts_text_and_preserves_message(monkeypatch, content):
    message = AIMessage(content=content)
    graph = SimpleNamespace(ainvoke=AsyncMock(return_value={"messages": [message]}))

    @contextmanager
    def compiled(*args):
        yield graph, {}, {}

    monkeypatch.setattr(generate_response, "__compiled_graph", compiled)
    response, state = asyncio.run(
        generate_response.get_response("Hi", "player", make_character("hannibal"))
    )
    assert response == "Hello world"
    assert state["messages"][0].content == content


def test_stream_extracts_text_and_filters_other_nodes(monkeypatch):
    async def stream(**kwargs):
        yield AIMessageChunk(content="ignored"), {"langgraph_node": "summary"}
        yield AIMessageChunk(content="Hello "), {"langgraph_node": "conversation_node"}
        yield (
            AIMessageChunk(content=BLOCKS[0:1]),
            {"langgraph_node": "conversation_node"},
        )
        yield (
            AIMessageChunk(content=BLOCKS[2:]),
            {"langgraph_node": "conversation_node"},
        )

    @contextmanager
    def compiled(*args):
        yield SimpleNamespace(astream=stream), {}, {}

    monkeypatch.setattr(generate_response, "__compiled_graph", compiled)

    async def collect():
        return [
            chunk
            async for chunk in generate_response.get_streaming_response(
                "Hi", "player", make_character("hannibal")
            )
        ]

    chunks = asyncio.run(collect())
    assert chunks == ["Hello ", "", "world"]
    assert "".join(chunks) == "Hello world"


def test_summaries_extract_text(monkeypatch):
    chain = SimpleNamespace(ainvoke=AsyncMock(return_value=AIMessage(content=BLOCKS)))
    monkeypatch.setattr(nodes, "get_conversation_summary_chain", lambda summary: chain)
    monkeypatch.setattr(nodes, "get_context_summary_chain", lambda: chain)
    tool_message = ToolMessage(content=BLOCKS, tool_call_id="search")
    state = {"messages": [tool_message], "character_name": "Hannibal"}
    summary = asyncio.run(nodes.summarize_conversation_node(state))
    assert summary["summary"] == "Hello world"
    asyncio.run(nodes.summarize_context_node(state))
    chain.ainvoke.assert_awaited_with({"context": "Hello world"})
    assert tool_message.content == "Hello world"


def test_state_description_uses_text():
    description = state_to_str({"messages": [AIMessage(content=BLOCKS)]})
    assert "Ai: Hello world" in description
    assert "private reasoning" not in description


def test_conversation_history_is_shared_within_a_game_and_isolated_between_games(
    monkeypatch,
):
    histories = {}

    async def invoke(input, config):
        history = histories.setdefault(config["configurable"]["thread_id"], [])
        response = history[0].text if history else "Fresh conversation"
        history.extend(input["messages"])
        history.append(AIMessage(content=response))
        return {**input, "messages": list(history)}

    async def stream(input, config, stream_mode):
        result = await invoke(input, config)
        yield (
            AIMessageChunk(content=result["messages"][-1].text),
            {"langgraph_node": "conversation_node"},
        )

    graph = SimpleNamespace(ainvoke=invoke, astream=stream, get_graph=Mock())
    builder = Mock()
    builder.compile.return_value = graph
    monkeypatch.setattr(generate_response, "create_workflow_graph", lambda: builder)
    monkeypatch.setattr(generate_response, "OpikTracer", Mock())
    monkeypatch.setattr(
        generate_response.MongoDBSaver,
        "from_conn_string",
        lambda **kwargs: nullcontext(Mock()),
    )
    hannibal, scipio = make_character("hannibal"), make_character("scipio")

    async def scenario():
        response, _ = await generate_response.get_response(
            "Old negotiation", hannibal.id, scipio, game_id="first-game"
        )
        assert response == "Fresh conversation"
        for game_id, expected in [
            ("first-game", "Old negotiation"),
            ("second-game", "Fresh conversation"),
        ]:
            chunks = [
                chunk
                async for chunk in generate_response.get_streaming_response(
                    "Continue", scipio.id, hannibal, game_id=game_id
                )
            ]
            assert "".join(chunks) == expected
        for _ in range(2):
            response, _ = await generate_response.get_response(
                "Independent conversation",
                hannibal.id,
                scipio,
                new_thread=True,
                game_id="first-game",
            )
            assert response == "Fresh conversation"
        assert len(histories) == 4

    asyncio.run(scenario())
