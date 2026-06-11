from typing import Optional

from loguru import logger
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from philoagents.config import settings
from philoagents.domain.game_state import GameState


class GameStateRepository:
    """Persists the active game state so a server restart can resume an in-progress game.

    All operations are best-effort: persistence failures are logged but never
    interrupt the game loop, which keeps running on its in-memory state.
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
        try:
            self.collection.replace_one(
                {"_id": self.GAME_STATE_DOC_ID},
                {
                    "_id": self.GAME_STATE_DOC_ID,
                    "state": state.model_dump(mode="json"),
                },
                upsert=True,
            )
            logger.debug(f"Persisted game state at round {state.round_number}.")
        except PyMongoError as e:
            logger.error(f"Failed to persist game state: {e}")

    def load(self) -> Optional[GameState]:
        try:
            document = self.collection.find_one({"_id": self.GAME_STATE_DOC_ID})
        except PyMongoError as e:
            logger.warning(f"Could not load saved game state: {e}")
            return None

        if document is None:
            return None

        try:
            return GameState.model_validate(document["state"])
        except Exception as e:
            logger.warning(f"Saved game state is invalid and will be ignored: {e}")
            return None

    def clear(self) -> None:
        try:
            self.collection.delete_one({"_id": self.GAME_STATE_DOC_ID})
        except PyMongoError as e:
            logger.error(f"Failed to clear saved game state: {e}")
