import asyncio
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.documents import Document
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from test_game_loop_service import make_character

from philoagents.application.conversation_service import generate_response
from philoagents.application.conversation_service.workflow import nodes, tools
from philoagents.application.evaluation.evaluate import evaluation_task


@pytest.mark.parametrize("retrieve", [False, True])
def test_evaluation_uses_question_answer_and_original_passages(monkeypatch, retrieve):
    character = make_character("hannibal")
    factory = Mock()
    factory.get_character.return_value = character
    monkeypatch.setattr(
        "philoagents.application.evaluation.evaluate.get_character_factory",
        lambda: factory,
    )
    monkeypatch.setattr(
        generate_response, "OpikTracer", lambda **kwargs: BaseCallbackHandler()
    )
    monkeypatch.setattr(
        generate_response.MongoDBSaver,
        "from_conn_string",
        lambda **kwargs: nullcontext(InMemorySaver()),
    )
    passages = ["First fact\n\nwith another paragraph", "Second fact"]
    retriever = Mock()
    retriever.invoke.return_value = [Document(page_content=p) for p in passages]
    monkeypatch.setattr(tools, "_retriever", lambda: retriever)
    responses = []
    if retrieve:
        for call_id in ["first-search", "second-search"]:
            responses.append(
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "retrieve_character_context",
                            "args": {"query": "Hannibal"},
                            "id": call_id,
                        }
                    ],
                )
            )
    responses.append(AIMessage(content="Generated answer"))
    chain = SimpleNamespace(ainvoke=AsyncMock(side_effect=responses))
    monkeypatch.setattr(nodes, "get_character_response_chain", lambda: chain)
    summary_chain = SimpleNamespace(
        ainvoke=AsyncMock(return_value=AIMessage(content="Generated summary"))
    )
    monkeypatch.setattr(nodes, "get_context_summary_chain", lambda: summary_chain)
    monkeypatch.setattr(
        nodes, "get_conversation_summary_chain", lambda summary: summary_chain
    )
    # Force pruning of tool messages to prove evaluation retains source passages.
    monkeypatch.setattr(nodes.settings, "TOTAL_MESSAGES_SUMMARY_TRIGGER", 0)
    monkeypatch.setattr(nodes.settings, "TOTAL_MESSAGES_AFTER_SUMMARY", 1)
    messages = [
        {"role": "user", "content": "Earlier question"},
        {"role": "assistant", "content": "Earlier answer"},
        {"role": "user", "content": "Final question"},
        {"role": "assistant", "content": "Expected answer"},
    ]

    result = asyncio.run(
        evaluation_task({"character_id": character.id, "messages": messages})
    )

    assert result == {
        "input": "Final question",
        "expected_output": "Expected answer",
        "output": "Generated answer",
        "context": passages * 2 if retrieve else [],
    }
    assert chain.ainvoke.await_args_list[0].args[0]["messages"][0].text == (
        "Earlier question"
    )
