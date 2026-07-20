import asyncio

from loguru import logger
from pymongo import MongoClient

from philoagents.config import settings


async def reset_conversation_state() -> dict:
    """Deletes all conversation state data from MongoDB.

    This function removes all stored conversation checkpoints and writes,
    effectively resetting all philosopher conversations.

    Returns:
        dict: Status message indicating success or failure with details
              about which collections were deleted

    Raises:
        Exception: If there's an error connecting to MongoDB or deleting collections
    """
    return await asyncio.to_thread(_reset_conversation_state)


def _reset_conversation_state() -> dict:
    try:
        with MongoClient(settings.MONGO_URI) as client:
            db = client[settings.MONGO_DB_NAME]

            collections_deleted = []
            for collection in (
                settings.MONGO_STATE_CHECKPOINT_COLLECTION,
                settings.MONGO_STATE_WRITES_COLLECTION,
            ):
                if collection in db.list_collection_names():
                    db.drop_collection(collection)
                    collections_deleted.append(collection)
                    logger.info(f"Deleted collection: {collection}")

        if collections_deleted:
            return {
                "status": "success",
                "message": f"Successfully deleted collections: {', '.join(collections_deleted)}",
            }
        return {
            "status": "success",
            "message": "No collections needed to be deleted",
        }

    except Exception as e:
        logger.error(f"Failed to reset conversation state: {str(e)}")
        raise Exception(f"Failed to reset conversation state: {str(e)}")
