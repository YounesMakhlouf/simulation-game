from unittest.mock import Mock

import pytest
from pymongo.errors import ConnectionFailure

from philoagents.application.conversation_service import reset_conversation
from philoagents.infrastructure.mongo.game_state_repository import GameStateRepository


@pytest.mark.parametrize("document", [{}, {"state": None}, {"state": {}}])
def test_invalid_saved_state_is_ignored(document):
    repository = GameStateRepository.__new__(GameStateRepository)
    repository.collection = Mock()
    repository.collection.find_one.return_value = document
    assert repository.load() is None


def test_reset_preserves_database_error_cause(monkeypatch):
    error = ConnectionFailure("database unavailable")
    monkeypatch.setattr(reset_conversation, "MongoClient", Mock(side_effect=error))
    with pytest.raises(RuntimeError, match="Failed to reset") as raised:
        reset_conversation._reset_conversation_state()
    assert raised.value.__cause__ is error
