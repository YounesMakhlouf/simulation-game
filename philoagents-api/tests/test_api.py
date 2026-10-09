from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import ConnectionFailure
from test_game_loop_service import (
    FakeStateRepository,
    make_action,
    make_character,
    make_service,
    stub_echo_judge,
    stub_round,
)

from philoagents.domain.character_factory import CharacterFactory
from philoagents.infrastructure import api


def test_dependency_injection_and_chat(monkeypatch):
    service = make_service()
    factory = CharacterFactory([make_character("hannibal").model_dump()])

    async def respond(**kwargs):
        assert kwargs["receiver_character"].id == "hannibal"
        return "Hello", None

    monkeypatch.setattr(api, "get_response", respond)
    monkeypatch.setitem(
        api.app.dependency_overrides, api.get_game_service, lambda: service
    )
    monkeypatch.setitem(
        api.app.dependency_overrides, api.get_character_factory, lambda: factory
    )
    with TestClient(api.app) as client:
        assert client.get("/game/session").json()["player_character_id"] is None
        assert (
            client.get("/game/characters").json()["characters"][0]["id"] == "hannibal"
        )
        response = client.post(
            "/chat",
            json={"message": "Hi", "sender_id": "player", "receiver_id": "hannibal"},
        )
        assert response.status_code == 200
        assert response.json() == {"response": "Hello"}
        with client.websocket_connect("/ws/chat") as websocket:
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
