import asyncio
from unittest.mock import ANY, AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from pymongo.errors import ConnectionFailure
from starlette.websockets import WebSocketDisconnect
from test_game_loop_service import (
    FakeStateRepository,
    make_action,
    make_character,
    make_service,
    stub_echo_judge,
    stub_round,
)

from philoagents.application.conversation_service import generate_response, negotiation
from philoagents.application.conversation_service.workflow import (
    nodes as conversation_nodes,
)
from philoagents.application.game_loop_service import api as game_api
from philoagents.application.game_loop_service import service as game_service_module
from philoagents.application.game_loop_service.workflow import nodes as action_nodes
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.domain.character_factory import CharacterFactory
from philoagents.infrastructure import api
from philoagents.infrastructure.dependencies import get_character_factory


@pytest.fixture(autouse=True)
def negotiation_chain(monkeypatch):
    chain = Mock()
    chain.ainvoke = AsyncMock(
        return_value=AIMessage(
            content="Round 1: Scipio proposed peace; Hannibal agreed."
        )
    )
    monkeypatch.setattr(negotiation, "get_negotiation_summary_chain", lambda: chain)
    monkeypatch.setattr(
        negotiation, "OpikTracer", lambda **kwargs: BaseCallbackHandler()
    )
    return chain


def test_dependency_injection_and_chat(monkeypatch):
    service = make_service()
    character = make_character("hannibal").model_dump()
    character["ui_profile"] = {
        "title": "General",
        "strengths": "Veteran troops",
        "objectives": "Secure a supply port",
        "portrait_key": "hannibal_barca_portrait",
    }
    factory = CharacterFactory([character])

    async def respond(**kwargs):
        assert kwargs["receiver_character"].id == "hannibal"
        assert kwargs["game_id"] == service.game_state.game_id
        return "Hello", None

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setitem(
        api.app.dependency_overrides, api.get_game_service, lambda: service
    )
    monkeypatch.setitem(
        api.app.dependency_overrides, get_character_factory, lambda: factory
    )
    with TestClient(api.app) as client:
        assert client.get("/game/session").json()["player_character_id"] is None
        assert (
            client.get("/game/characters").json()["characters"][0]["id"] == "hannibal"
        )
        response = client.post(
            "/chat",
            json={"message": "Hi", "sender_id": "scipio", "receiver_id": "hannibal"},
        )
        assert response.status_code == 200
        assert response.json() == {"response": "Hello"}
        with client.websocket_connect(
            "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
        ) as websocket:
            websocket.send_bytes(b"not a text frame")
            assert "Only text" in websocket.receive_json()["error"]
            websocket.send_text("invalid JSON")
            assert "valid JSON" in websocket.receive_json()["error"]


@pytest.fixture
def game_client(monkeypatch):
    service = make_service(FakeStateRepository())
    monkeypatch.setitem(
        api.app.dependency_overrides, api.get_game_service, lambda: service
    )
    with TestClient(api.app) as client:
        yield client, service


@pytest.mark.parametrize(
    "origin",
    [None, "null", "https://untrusted.example", "https://allowed.example.evil"],
)
def test_websocket_rejects_untrusted_origins_before_chat(
    game_client, monkeypatch, origin
):
    client, service = game_client
    monkeypatch.setattr(api.settings, "CORS_ALLOW_ORIGINS", ["https://allowed.example"])
    stream = Mock()
    monkeypatch.setattr(api, "get_streaming_response", stream)
    initial = service.get_current_state()
    with (
        pytest.raises(WebSocketDisconnect) as closed,
        client.websocket_connect(
            "/ws/chat", headers={"origin": origin} if origin is not None else {}
        ),
    ):
        pytest.fail("Untrusted connection was accepted")
    assert closed.value.code == 1008
    stream.assert_not_called()
    assert service.get_current_state() == initial


def test_websocket_accepts_configured_origin(game_client, monkeypatch):
    client, _ = game_client
    monkeypatch.setattr(api.settings, "CORS_ALLOW_ORIGINS", ["https://allowed.example"])
    with client.websocket_connect(
        "/ws/chat", headers={"origin": "https://allowed.example"}
    ) as websocket:
        websocket.send_text("invalid JSON")
        assert "valid JSON" in websocket.receive_json()["error"]


@pytest.mark.parametrize("invalid", ["too_long", "wrong_type", "missing_id", "array"])
def test_chat_validation_is_shared_and_rejected_turns_do_not_reach_models(
    game_client, monkeypatch, negotiation_chain, invalid
):
    client, service = game_client
    payload = {"message": "Hi", "sender_id": "scipio", "receiver_id": "hannibal"}
    if invalid == "too_long":
        payload["message"] = "x" * (api.settings.MAX_CHAT_MESSAGE_CHARS + 1)
    elif invalid == "wrong_type":
        payload["message"] = 123
    elif invalid == "missing_id":
        del payload["receiver_id"]
    else:
        payload = []
    respond = AsyncMock(return_value=("Hello", None))
    streaming_messages = []

    async def stream(**kwargs):
        streaming_messages.append(kwargs["messages"])
        yield "Hello"

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setattr(api, "get_streaming_response", stream)
    assert client.post("/chat", json=payload).status_code == 422
    with client.websocket_connect(
        "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
    ) as websocket:
        websocket.send_json(payload)
        assert "error" in websocket.receive_json()
        respond.assert_not_awaited()
        assert streaming_messages == []
        negotiation_chain.ainvoke.assert_not_awaited()
        assert service.state_repository.save_calls == 0

        websocket.send_json(
            {"message": "Hi", "sender_id": "scipio", "receiver_id": "hannibal"}
        )
        assert websocket.receive_json() == {"streaming": True}
        assert websocket.receive_json() == {"chunk": "Hello"}
        assert websocket.receive_json() == {"response": "Hello", "streaming": False}
    assert streaming_messages == ["Hi"]


@pytest.mark.parametrize("streaming", [False, True])
def test_chat_accepts_text_at_the_configured_limit(game_client, monkeypatch, streaming):
    client, _service = game_client
    text = "x" * api.settings.MAX_CHAT_MESSAGE_CHARS
    payload = {"message": text, "sender_id": "scipio", "receiver_id": "hannibal"}
    received = []

    async def respond(**kwargs):
        received.append(kwargs["messages"])
        return "Hello", None

    async def stream(**kwargs):
        received.append(kwargs["messages"])
        yield "Hello"

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setattr(api, "get_streaming_response", stream)
    if streaming:
        with client.websocket_connect(
            "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
        ) as websocket:
            websocket.send_json(payload)
            assert websocket.receive_json() == {"streaming": True}
            assert websocket.receive_json() == {"chunk": "Hello"}
            assert websocket.receive_json()["response"] == "Hello"
    else:
        assert client.post("/chat", json=payload).status_code == 200
    assert received == [text]


@pytest.mark.parametrize("endpoint", ["/game/action", "/game/end"])
@pytest.mark.parametrize("extra_chars", [0, 1])
def test_player_text_limits_are_checked_before_actions_or_scoring(
    game_client, monkeypatch, endpoint, extra_chars
):
    client, service = game_client
    text = "x" * (api.settings.MAX_CHAT_MESSAGE_CHARS + extra_chars)
    advance = AsyncMock()
    monkeypatch.setattr(service, "advance_round", advance)
    if endpoint == "/game/action":
        field = "action_details"
        payload = make_action("hannibal").model_dump(mode="json")
        handler = Mock()
        monkeypatch.setattr(service, "submit_player_action", handler)
        success_status = 202
    else:
        field = "undergame_guess"
        payload = {"player_character_id": "hannibal"}
        handler = AsyncMock(return_value=({}, "The secret plot."))
        monkeypatch.setattr(service, "finalize_scores", handler)
        success_status = 200
    payload[field] = text

    response = client.post(endpoint, json=payload)
    if extra_chars:
        assert response.status_code == 422
        error = response.json()["detail"][0]
        assert error["loc"] == ["body", field]
        assert error["type"] == "string_too_long"
        handler.assert_not_called()
        advance.assert_not_awaited()
        assert not service.is_processing_round
        assert service.state_repository.save_calls == 0
    else:
        assert response.status_code == success_status
        handler.assert_called_once()
        if endpoint == "/game/action":
            assert handler.call_args.args[0].action_details == text
        else:
            assert handler.call_args.kwargs["undergame_guess"] == text


def test_chat_uses_new_game_id_after_reset_on_existing_socket(game_client, monkeypatch):
    client, service = game_client
    rest_ids, streaming_ids = [], []

    async def respond(**kwargs):
        rest_ids.append(kwargs["game_id"])
        return "Hello", None

    async def stream(**kwargs):
        streaming_ids.append(kwargs["game_id"])
        yield "Hello"

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setattr(api, "get_streaming_response", stream)
    payload = {"message": "Hi", "sender_id": "scipio", "receiver_id": "hannibal"}
    original_id = service.game_state.game_id
    with client.websocket_connect(
        "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
    ) as websocket:
        for _ in range(2):
            assert client.post("/chat", json=payload).status_code == 200
            websocket.send_json(payload)
            assert websocket.receive_json() == {"streaming": True}
            assert websocket.receive_json() == {"chunk": "Hello"}
            assert websocket.receive_json() == {"response": "Hello", "streaming": False}
            if len(rest_ids) == 1:
                assert client.post("/game/reset").status_code == 200
    assert original_id != service.game_state.game_id
    assert rest_ids == streaming_ids == [original_id, service.game_state.game_id]


def test_failed_round_is_reported_and_retries_original_action(game_client):
    client, service = game_client
    assert (
        client.post("/game/start", json={"character_id": "hannibal"}).status_code == 200
    )
    stub_round(service, judge_error=RuntimeError("private provider details"))
    action = make_action("hannibal", {"Gold": 4}).model_dump(mode="json")
    assert client.post("/game/action", json=action).status_code == 202

    status = client.get("/game/status/hannibal").json()
    assert status["round_number"] == 1
    assert status["has_pending_action"]
    assert not status["is_processing_round"]
    assert "could not be completed" in status["round_error"]
    assert "private provider details" not in status["round_error"]
    assert client.post("/game/action", json=action).status_code == 400

    stub_echo_judge(service)
    assert client.post("/game/retry").status_code == 202
    status = client.get("/game/status/hannibal").json()
    assert status["round_number"] == 2
    assert status["your_character"]["resources"]["Gold"] == 6
    assert not status["has_pending_action"]
    assert status["round_error"] is None
    assert client.post("/game/retry").status_code == 409


def test_retry_rejects_processing_round(game_client):
    client, service = game_client
    service.submitted_actions["hannibal"] = make_action("hannibal")
    service.is_processing_round = True
    assert client.post("/game/retry").status_code == 409


@pytest.mark.parametrize("ai_timeout", [30, 120, 240])
def test_session_exposes_configured_scoring_timeout(
    game_client, monkeypatch, ai_timeout
):
    client, _service = game_client
    monkeypatch.setattr(game_api.settings, "AI_ACTION_TIMEOUT_SECONDS", ai_timeout)
    response = client.get("/game/session")
    assert response.status_code == 200
    assert response.json()["scoring_timeout_ms"] == (ai_timeout + 30) * 1000


def test_session_reports_the_saved_delegate_and_current_round(game_client):
    client, service = game_client
    assert client.get("/game/session").json()["player_character_id"] is None
    assert (
        client.post("/game/start", json={"character_id": "hannibal"}).status_code == 200
    )
    service.game_state.round_number = 4
    session = client.get("/game/session").json()
    assert session["player_character_id"] == "hannibal"
    assert (
        session["player_character_name"]
        == service.game_state.characters["hannibal"].name
    )
    assert session["round_number"] == 4


def test_selection_profiles_expose_public_strengths_and_objectives(
    game_client, monkeypatch
):
    client, _ = game_client
    loader = ScenarioLoader("scenarios/a_clash_of_titans_216bce")
    monkeypatch.setitem(
        api.app.dependency_overrides,
        get_character_factory,
        loader.create_character_factory,
    )
    response = client.get("/game/characters")
    assert response.status_code == 200
    profiles = response.json()["characters"]
    assert len(profiles) == 4
    for profile, character in zip(profiles, loader.character_data, strict=True):
        assert profile == {
            "id": character["id"],
            "name": character["name"],
            **character["ui_profile"],
        }
        assert profile["strengths"]
        assert profile["objectives"]
        assert "known_intel" not in profile


def test_failed_game_write_returns_503_and_keeps_state(game_client, monkeypatch):
    client, service = game_client
    monkeypatch.setattr(
        service.state_repository,
        "save",
        Mock(side_effect=ConnectionFailure("private host details")),
    )
    response = client.post("/game/start", json={"character_id": "hannibal"})
    assert response.status_code == 503
    assert response.json() == {
        "detail": "Game storage is unavailable. Please try again."
    }
    assert service.game_state.player_character_id is None


def test_storage_failure_aborts_startup(monkeypatch):
    monkeypatch.setitem(
        api.app.dependency_overrides,
        api.get_game_service,
        Mock(side_effect=ConnectionFailure("offline")),
    )
    with pytest.raises(ConnectionFailure), TestClient(api.app):
        pass


@pytest.mark.parametrize("streaming", [False, True])
def test_negotiations_use_live_state_and_reach_only_participants_actions(
    game_client, monkeypatch, negotiation_chain, streaming
):
    client, service = game_client
    assert (
        client.post("/game/start", json={"character_id": "scipio"}).status_code == 200
    )
    service.game_state.round_number = 2
    service.game_state.crisis_update = "Rome is under siege."
    receiver = service.game_state.characters["hannibal"]
    receiver.resources = {"Gold": 2}
    receiver.statuses = {"Morale": "Low"}
    receiver.known_intel = ["Private report for Hannibal"]
    service.game_state.characters["hanno"] = make_character("hanno")
    service.game_state.characters["scipio"].known_intel = ["Scipio's secret"]
    previous = "Round 1: Scipio offered a truce; no agreement yet."
    service.game_state.negotiation_summaries = {
        "hannibal": {"scipio": previous},
        "scipio": {"hannibal": previous, "hanno": "A separate private bargain"},
        "hanno": {"scipio": "A separate private bargain"},
    }
    summary = "Round 2: Scipio offered a truce; Hannibal accepted."
    negotiation_chain.ainvoke.return_value = AIMessage(content=summary)

    def check_context(kwargs):
        assert kwargs["receiver_character"] == receiver
        assert kwargs["crisis_update"] == "Round 2: Rome is under siege."
        assert kwargs["negotiation_summaries"] == {"scipio": previous}

    async def respond(**kwargs):
        check_context(kwargs)
        return "I accept your truce.", None

    async def stream(**kwargs):
        check_context(kwargs)
        yield "I accept your truce."

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setattr(api, "get_streaming_response", stream)
    payload = {
        "message": "Let us agree a truce.",
        "sender_id": "scipio",
        "receiver_id": "hannibal",
    }
    if streaming:
        with client.websocket_connect(
            "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
        ) as websocket:
            websocket.send_json(payload)
            assert websocket.receive_json() == {"streaming": True}
            assert websocket.receive_json() == {"chunk": "I accept your truce."}
            assert websocket.receive_json()["streaming"] is False
    else:
        assert client.post("/chat", json=payload).json() == {
            "response": "I accept your truce."
        }

    negotiation_chain.ainvoke.assert_awaited_once_with(
        {
            "sender_name": "Scipio",
            "receiver_name": "Hannibal",
            "round_number": 2,
            "previous_summary": previous,
            "message": payload["message"],
            "response": "I accept your truce.",
        },
        config=ANY,
    )
    assert service.game_state.negotiation_summaries["hannibal"] == {"scipio": summary}
    assert service.game_state.negotiation_summaries["scipio"]["hannibal"] == summary
    assert service.game_state.negotiation_summaries["hanno"] == {
        "scipio": "A separate private bargain"
    }
    assert service.state_repository.saved == service.game_state

    resumed = make_service(service.state_repository)
    assert resumed.try_resume()
    captured = {}

    async def decide(inputs):
        captured[inputs["character_id"]] = inputs
        return make_action(inputs["character_id"])

    chain = Mock(ainvoke=AsyncMock(side_effect=decide))
    monkeypatch.setattr(action_nodes, "get_character_action_chain", lambda: chain)
    monkeypatch.setattr(
        game_service_module, "OpikTracer", lambda **kwargs: BaseCallbackHandler()
    )
    resumed.submit_player_action(make_action("scipio"))
    asyncio.run(resumed._run_ai_delegate_turns())
    assert captured["hannibal"]["negotiation_summaries"] == {"scipio": summary}
    assert captured["hanno"]["negotiation_summaries"] == {
        "scipio": "A separate private bargain"
    }
    assert captured["hannibal"]["character_resources"] == {"Gold": 2}
    assert captured["hannibal"]["crisis_update"] == "Round 2: Rome is under siege."
    assert captured["hannibal"]["known_intel"] == "Private report for Hannibal"


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("failure", ["summary", "empty_summary", "save"])
def test_failed_negotiation_is_reported_without_publishing_unsaved_memory(
    game_client, monkeypatch, negotiation_chain, streaming, failure
):
    client, service = game_client
    client.post("/game/start", json={"character_id": "scipio"})
    initial = service.get_current_state()
    monkeypatch.setattr(api, "get_response", AsyncMock(return_value=("I agree.", None)))

    async def stream(**kwargs):
        yield "I agree."

    monkeypatch.setattr(api, "get_streaming_response", stream)
    if failure == "summary":
        negotiation_chain.ainvoke.side_effect = RuntimeError("private provider details")
    elif failure == "empty_summary":
        negotiation_chain.ainvoke.return_value = AIMessage(
            content="", response_metadata={"finish_reason": "length"}
        )
    else:
        monkeypatch.setattr(
            service.state_repository,
            "save",
            Mock(side_effect=ConnectionFailure("private host details")),
        )
    payload = {"message": "Agree?", "sender_id": "scipio", "receiver_id": "hannibal"}
    if streaming:
        with client.websocket_connect(
            "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
        ) as websocket:
            websocket.send_json(payload)
            assert websocket.receive_json() == {"streaming": True}
            assert websocket.receive_json() == {"chunk": "I agree."}
            error = websocket.receive_json()
            assert "error" in error
            assert "private" not in error["error"]
    else:
        response = client.post("/chat", json=payload)
        assert response.status_code == (503 if failure == "save" else 500)
        assert "private" not in response.json()["detail"]
    assert service.get_current_state() == initial
    assert service.state_repository.saved == initial
    assert not service._round_lock.locked()


def test_chat_keepalives_cover_generation_and_summary(
    game_client, monkeypatch, negotiation_chain
):
    client, service = game_client
    client.post("/game/start", json={"character_id": "scipio"})
    monkeypatch.setattr(api, "_CHAT_HEARTBEAT_SECONDS", 0.01)

    async def stream(**kwargs):
        await asyncio.sleep(0.04)
        yield "Reply"

    async def summarize(*args, **kwargs):
        await asyncio.sleep(0.04)
        return AIMessage(content="No relevant negotiations.")

    monkeypatch.setattr(api, "get_streaming_response", stream)
    negotiation_chain.ainvoke.side_effect = summarize
    with client.websocket_connect(
        "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
    ) as websocket:
        websocket.send_json(
            {"message": "Hi", "sender_id": "scipio", "receiver_id": "hannibal"}
        )
        assert websocket.receive_json() == {"streaming": True}
        frames = []
        while True:
            frame = websocket.receive_json()
            frames.append(frame)
            if frame.get("streaming") is False:
                break
        chunk_index = frames.index({"chunk": "Reply"})
        assert {"streaming": True} in frames[:chunk_index]
        assert {"streaming": True} in frames[chunk_index + 1 : -1]
        assert frames[-1] == {"response": "Reply", "streaming": False}
        websocket.send_json({"invalid": "message"})
        assert "error" in websocket.receive_json()
    assert (
        service.game_state.negotiation_summaries["hannibal"]["scipio"]
        == "No relevant negotiations."
    )


@pytest.mark.parametrize(
    "blocked", ["unknown", "wrong_player", "processing", "pending"]
)
def test_invalid_or_late_negotiation_never_calls_the_model(
    game_client, monkeypatch, blocked
):
    client, service = game_client
    client.post("/game/start", json={"character_id": "scipio"})
    sender = "scipio"
    if blocked == "unknown":
        sender = "unknown"
    elif blocked == "wrong_player":
        sender = "hannibal"
    elif blocked == "processing":
        service.is_processing_round = True
    else:
        service.submitted_actions["scipio"] = make_action("scipio")
    respond = AsyncMock()
    monkeypatch.setattr(api, "get_response", respond)
    response = client.post(
        "/chat", json={"message": "Hi", "sender_id": sender, "receiver_id": "hannibal"}
    )
    assert response.status_code == 400
    respond.assert_not_awaited()


@pytest.mark.parametrize("streaming", [False, True])
@pytest.mark.parametrize("failure", ["summary", "save"])
def test_failed_chat_is_absent_from_next_turn_history(
    game_client, monkeypatch, negotiation_chain, streaming, failure
):
    client, service = game_client
    client.post("/game/start", json={"character_id": "scipio"})
    seen = []

    def capture(inputs):
        seen.append([message.text for message in inputs["messages"]])
        return inputs["messages"]

    chain = RunnableLambda(capture) | FakeListChatModel(responses=["Reply"])
    monkeypatch.setattr(
        conversation_nodes, "get_character_response_chain", lambda: chain
    )
    monkeypatch.setattr(
        generate_response, "OpikTracer", lambda **kwargs: BaseCallbackHandler()
    )
    mongo = Mock(
        side_effect=AssertionError("Game chat must not write Mongo checkpoints")
    )
    monkeypatch.setattr(generate_response.MongoDBSaver, "from_conn_string", mongo)

    def exchange(message, succeeds=True):
        payload = {"message": message, "sender_id": "scipio", "receiver_id": "hannibal"}
        if streaming:
            with client.websocket_connect(
                "/ws/chat", headers={"origin": api.settings.CORS_ALLOW_ORIGINS[0]}
            ) as websocket:
                websocket.send_json(payload)
                assert websocket.receive_json() == {"streaming": True}
                while True:
                    frame = websocket.receive_json()
                    if "chunk" in frame:
                        continue
                    assert ("error" not in frame) == succeeds
                    break
        else:
            response = client.post("/chat", json=payload)
            assert (response.status_code == 200) == succeeds

    exchange("Accepted offer")
    accepted = service.get_current_state()
    assert accepted.conversation_histories
    original_save = service.state_repository.save
    if failure == "summary":
        negotiation_chain.ainvoke.side_effect = RuntimeError("Summary failed")
    else:
        monkeypatch.setattr(
            service.state_repository,
            "save",
            Mock(side_effect=ConnectionFailure("Save failed")),
        )
    exchange("Rejected offer", succeeds=False)
    assert service.get_current_state() == accepted
    assert service.state_repository.saved == accepted

    negotiation_chain.ainvoke.side_effect = None
    monkeypatch.setattr(service.state_repository, "save", original_save)
    resumed = make_service(service.state_repository)
    assert resumed.try_resume()
    service.game_state = resumed.game_state
    exchange("Next offer")
    assert seen[-1] == ["Accepted offer", "Reply", "Next offer"]
    mongo.assert_not_called()

    monkeypatch.setattr(
        api, "reset_conversation_state", AsyncMock(return_value={"status": "success"})
    )
    assert client.post("/reset-memory").status_code == 200
    assert service.state_repository.saved.conversation_histories == {}
    exchange("After memory reset")
    assert seen[-1] == ["After memory reset"]
    assert client.post("/game/reset").status_code == 200
    exchange("New playthrough")
    assert seen[-1] == ["New playthrough"]
