from fastapi.testclient import TestClient
from test_game_loop_service import make_character, make_service

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
