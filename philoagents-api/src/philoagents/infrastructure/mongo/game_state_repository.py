from loguru import logger
from pydantic import ValidationError
from pymongo import MongoClient

from philoagents.config import settings
from philoagents.domain.game_state import GameState


class GameStateRepository:
    """Persists the active game state so a server restart can resume an in-progress game.

    Storage errors propagate so callers cannot report unsaved changes as success.
    """

    GAME_STATE_DOC_ID = "active_game"

    def __init__(
        self,
        mongodb_uri: str = settings.MONGO_URI,
        database_name: str = settings.MONGO_DB_NAME,
        collection_name: str = settings.MONGO_GAME_STATE_COLLECTION,
    ) -> None:
        self.client = MongoClient(
            mongodb_uri, appname="philoagents", serverSelectionTimeoutMS=5000
        )
        self.collection = self.client[database_name][collection_name]

    def save(self, state: GameState) -> None:
        self.collection.replace_one(
            {"_id": self.GAME_STATE_DOC_ID},
            {"_id": self.GAME_STATE_DOC_ID, "state": state.model_dump(mode="json")},
            upsert=True,
        )
        logger.debug(f"Persisted game state at round {state.round_number}.")

    def load(self) -> GameState | None:
        document = self.collection.find_one({"_id": self.GAME_STATE_DOC_ID})

        if document is None:
            return None

        try:
            return GameState.model_validate(document["state"])
        except (ValidationError, KeyError, TypeError) as e:
            raise ValueError(
                "Saved game state is invalid; refusing to overwrite it."
            ) from e

    def clear(self) -> None:
        self.collection.delete_one({"_id": self.GAME_STATE_DOC_ID})
