import os

import opik
from loguru import logger

from philoagents.config import settings


def configure() -> None:
    if settings.COMET_API_KEY and settings.COMET_PROJECT:
        os.environ["OPIK_PROJECT_NAME"] = settings.COMET_PROJECT

        try:
            # opik.configure resolves the API key's default workspace itself when
            # none is passed; force=True implies automatic_approvals, so it stays
            # non-interactive on a server. This avoids opik's private
            # OpikConfigurator._get_default_workspace().
            opik.configure(
                api_key=settings.COMET_API_KEY,
                use_local=False,
                force=True,
            )
            logger.info("Opik configured successfully.")
        except Exception:
            logger.warning(
                "Couldn't configure Opik. There is probably a problem with the COMET_API_KEY or COMET_PROJECT environment variables or with the Opik server."
            )
    else:
        logger.warning(
            "COMET_API_KEY and COMET_PROJECT are not set. Set them to enable prompt monitoring with Opik (powered by Comet ML)."
        )


def get_dataset(name: str) -> opik.Dataset | None:
    client = opik.Opik()
    try:
        dataset = client.get_dataset(name=name)
    except Exception:
        dataset = None

    return dataset


def create_dataset(name: str, description: str, items: list[dict]) -> opik.Dataset:
    client = opik.Opik()
    existing_dataset = get_dataset(name=name)

    # Only try to delete it if it was found.
    if existing_dataset:
        logger.warning(
            f"Dataset '{name}' already exists. Deleting it before creating a new one."
        )
        try:
            client.delete_dataset(name=name)
            logger.info(f"Successfully deleted existing dataset '{name}'.")
        except Exception as e:
            logger.error(f"Failed to delete existing dataset '{name}': {e}")
            raise e

    dataset = client.create_dataset(name=name, description=description)
    dataset.insert(items)

    return dataset
