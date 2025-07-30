import os

import opik
from loguru import logger
from opik.configurator.configure import OpikConfigurator

from philoagents.config import settings


def configure() -> None:
    if settings.COMET_API_KEY and settings.COMET_PROJECT:
        try:
            client = OpikConfigurator(api_key=settings.COMET_API_KEY)
            default_workspace = client._get_default_workspace()
        except Exception:
            logger.warning(
                "Default workspace not found. Setting workspace to None and enabling interactive mode."
            )
            default_workspace = None

        os.environ["OPIK_PROJECT_NAME"] = settings.COMET_PROJECT

        try:
            opik.configure(
                api_key=settings.COMET_API_KEY,
                workspace=default_workspace,
                use_local=False,
                force=True,
            )
            logger.info(
                f"Opik configured successfully using workspace '{default_workspace}'"
            )
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
