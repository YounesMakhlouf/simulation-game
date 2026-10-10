import asyncio
from contextlib import contextmanager, nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, AIMessageChunk, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from test_game_loop_service import make_character

from philoagents.application.conversation_service import generate_response
from philoagents.application.conversation_service.workflow import chains, nodes, tools
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
        generate_response.get_response(
            "Hi",
            "player",
            make_character("hannibal"),
            crisis_update="Current crisis",
            negotiation_summaries={},
        )
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
                "Hi",
                "player",
                make_character("hannibal"),
                crisis_update="Current crisis",
                negotiation_summaries={},
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


@pytest.mark.parametrize(
    "documents",
    [[], [Document(page_content="First fact"), Document(page_content="Second fact")]],
)
def test_retrieval_returns_document_text(monkeypatch, documents):
    retriever = Mock()
    retriever.invoke.return_value = documents
    monkeypatch.setattr(tools, "_retriever", lambda: retriever)
    message = tools.retrieve_character_context.invoke(
        {
            "name": "retrieve_character_context",
            "args": {"query": "Hanno"},
            "id": "search",
            "type": "tool_call",
        }
    )
    assert message.content == "\n\n".join(doc.page_content for doc in documents)
    assert message.artifact == [doc.page_content for doc in documents]


def test_empty_retrieval_skips_summary_model(monkeypatch):
    chain = Mock()
    monkeypatch.setattr(nodes, "get_context_summary_chain", chain)
    message = ToolMessage(content=[], tool_call_id="search")
    asyncio.run(nodes.summarize_context_node({"messages": [message]}))
    assert message.text == "No relevant historical facts were found."
    chain.assert_not_called()


def test_qwen_request_fits_observed_output_limit():
    model = chains.get_chat_model(model_name="qwen/qwen3.8-27b")
    assert model.max_tokens == 512
    assert model.reasoning_effort == "none"


@pytest.mark.parametrize("model_name", ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"])
def test_negotiation_summary_uses_supported_reasoning_setting(monkeypatch, model_name):
    monkeypatch.setattr(chains.settings, "GROQ_LLM_MODEL_SUMMARY", model_name)
    model = chains.get_negotiation_summary_chain().steps[1]
    if model_name.startswith("openai/gpt-oss-"):
        assert model.kwargs == {"reasoning_effort": "low"}
    else:
        assert model.reasoning_effort == "none"


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
            "Old negotiation",
            hannibal.id,
            scipio,
            game_id="first-game",
            crisis_update="Current crisis",
            negotiation_summaries={},
        )
        assert response == "Fresh conversation"
        for game_id, expected in [
            ("first-game", "Old negotiation"),
            ("second-game", "Fresh conversation"),
        ]:
            chunks = [
                chunk
                async for chunk in generate_response.get_streaming_response(
                    "Continue",
                    scipio.id,
                    hannibal,
                    game_id=game_id,
                    crisis_update="Current crisis",
                    negotiation_summaries={},
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
                crisis_update="Current crisis",
                negotiation_summaries={},
            )
            assert response == "Fresh conversation"
        assert len(histories) == 4

    asyncio.run(scenario())


def test_chat_graph_refreshes_live_context_on_every_turn(monkeypatch):
    chain = SimpleNamespace(ainvoke=AsyncMock(return_value=AIMessage(content="Reply")))
    monkeypatch.setattr(nodes, "get_character_response_chain", lambda: chain)
    monkeypatch.setattr(
        generate_response, "OpikTracer", lambda **kwargs: BaseCallbackHandler()
    )
    checkpointer = InMemorySaver()
    monkeypatch.setattr(
        generate_response.MongoDBSaver,
        "from_conn_string",
        lambda **kwargs: nullcontext(checkpointer),
    )
    character = make_character("hannibal")

    async def scenario():
        await generate_response.get_response(
            "First offer",
            "scipio",
            character,
            crisis_update="Initial crisis",
            negotiation_summaries={},
            game_id="game",
        )
        character.resources = {"Gold": 2}
        character.statuses = {"Morale": "Low"}
        character.known_intel = ["New private report"]
        await generate_response.get_response(
            "Second offer",
            "scipio",
            character,
            crisis_update="Updated crisis",
            negotiation_summaries={"scipio": "A truce was proposed."},
            game_id="game",
        )

    asyncio.run(scenario())
    assert chain.ainvoke.await_count == 2
    inputs = chain.ainvoke.await_args_list[-1].args[0]
    assert inputs["sender_id"] == "scipio"
    assert inputs["character_resources"] == {"Gold": 2}
    assert inputs["character_statuses"] == {"Morale": "Low"}
    assert inputs["known_intel"] == "New private report"
    assert inputs["crisis_update"] == "Updated crisis"
    assert inputs["negotiation_summaries"] == {"scipio": "A truce was proposed."}
