from pathlib import Path

import click
from loguru import logger

from philoagents.application.data import RagExtractor
from philoagents.application.evaluation import EvaluationDatasetGenerator
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings


@click.command()
@click.option(
    "--scenario_path",
    type=click.Path(exists=True, path_type=Path, file_okay=False, dir_okay=True),
    default=None,
    help="The path to the scenario pack directory (e.g., './scenarios/a_clash_of_titans_216bce/').",
)
@click.option(
    "--temperature",
    type=float,
    default=0.9,
    help="Temperature parameter for generation",
)
@click.option(
    "--max-samples",
    type=int,
    default=40,
    help="Maximum number of samples to generate",
)
def main(scenario_path: Path, temperature: float, max_samples: int) -> None:
    """
    Generates a structured evaluation dataset for a given scenario pack.

    This script loads a scenario, initializes the necessary components like the
    CharacterFactory and RagExtractor, and then runs the generation process,

    saving the output to the configured file path.
    """
    path_to_load = scenario_path if scenario_path else settings.SCENARIO_PATH
    if not path_to_load:
        print(
            "Error: No scenario path provided via command line or SCENARIO_PATH in .env file."
        )
        return

    logger.info("--- Starting Evaluation Dataset Generation ---")
    logger.info(f"Scenario Path: {path_to_load}")
    logger.info(
        f"Generation Parameters: temperature={temperature}, max_samples={max_samples}"
    )

    try:
        loader = ScenarioLoader(scenario_path=path_to_load)
        character_factory = loader.create_character_factory()
        rag_sources = loader.get_rag_sources()

        extractor = RagExtractor(character_factory=character_factory)

        dataset_generator = EvaluationDatasetGenerator(
            extractor=extractor, temperature=temperature, max_samples=max_samples
        )

        dataset_generator(rag_sources=rag_sources)

        logger.info(
            f"\n--- Dataset Generation for '{loader.manifest['name']}' Complete! ---"
        )

    except Exception as e:
        logger.error(f"An error occurred during dataset generation: {e}")
        raise e


if __name__ == "__main__":
    main()
