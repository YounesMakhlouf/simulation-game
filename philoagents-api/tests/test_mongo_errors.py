from unittest.mock import Mock

import pytest
from pymongo.errors import ConnectionFailure
from test_game_loop_service import make_state

from philoagents.application.conversation_service import reset_conversation
from philoagents.infrastructure.mongo.game_state_repository import GameStateRepository


@pytest.mark.parametrize("document", [{}, {"state": None}, {"state": {}}])
def test_invalid_saved_state_is_not_treated_as_an_absent_save(document):
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    repository.collection.find_one.return_value = document
    with pytest.raises(ValueError, match="refusing to overwrite"):
        repository.load()
    repository.collection.replace_one.assert_not_called()


@pytest.mark.parametrize(
    "method, operation",
    [("save", "replace_one"), ("load", "find_one"), ("clear", "delete_one")],
)
def test_storage_errors_reach_callers(method, operation):
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    error = ConnectionFailure("database unavailable")
    getattr(repository.collection, operation).side_effect = error
    args = [make_state()] if method == "save" else []
    with pytest.raises(ConnectionFailure) as raised:
        getattr(repository, method)(*args)
    assert raised.value is error


def test_absent_save_still_starts_a_new_game():
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    repository.collection.find_one.return_value = None
    assert repository.load() is None


def test_reset_preserves_database_error_cause(monkeypatch):
    error = ConnectionFailure("database unavailable")
    monkeypatch.setattr(reset_conversation, "MongoClient", Mock(side_effect=error))
    with pytest.raises(RuntimeError, match="Failed to reset") as raised:
        reset_conversation._reset_conversation_state()
    assert raised.value.__cause__ is error


def test_game_id_survives_reloads():
    state = make_state(round_number=3)
    document = {"state": state.model_dump(mode="json")}
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    repository.collection.find_one.side_effect = lambda query: document

    loaded = repository.load()
    reloaded = repository.load()
    assert loaded.game_id == reloaded.game_id == document["state"]["game_id"]
    assert loaded.round_number == state.round_number
    assert loaded.characters == state.characters
    repository.collection.replace_one.assert_not_called()
    assert loaded.game_id == state.game_id


@pytest.mark.parametrize("field", ["game_id", "negotiation_summaries"])
def test_save_missing_required_field_is_rejected_without_migration(field):
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    repository.collection.find_one.return_value = {
        "state": make_state().model_dump(mode="json", exclude={field})
    }
    with pytest.raises(ValueError, match="refusing to overwrite"):
        repository.load()
    repository.collection.replace_one.assert_not_called()
