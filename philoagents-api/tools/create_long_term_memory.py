from pathlib import Path

import click

from philoagents.application import LongTermMemoryCreator
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings


@click.command()
@click.option(
    "--scenario-path",
    type=click.Path(exists=True, path_type=Path),
    default=None,
    help="Path to the scenario pack directory (e.g., './scenarios/a_clash_of_titans_216bce/'). Overrides the SCENARIO_PATH in your .env file.",
)
def main(scenario_path: Path) -> None:
    """CLI command to create long-term memory for characters.

    Args:
        scenario_path: Path to the characters extraction metadata JSON file.
    """

    path_to_load = scenario_path if scenario_path else settings.SCENARIO_PATH
    if not path_to_load:
        print(
            "Error: No scenario path provided via command line or SCENARIO_PATH in .env file."
        )
        return

    print(f"--- Starting RAG Ingestion for Scenario: {path_to_load} ---")

    try:
        loader = ScenarioLoader(scenario_path=path_to_load)
        character_factory = loader.create_character_factory()
        rag_sources = loader.get_rag_sources()
    except FileNotFoundError as e:
        print(f"Error loading scenario: {e}")
        return

    long_term_memory_creator = LongTermMemoryCreator.build_from_settings(
        character_factory=character_factory
    )

    long_term_memory_creator(rag_sources=rag_sources)

    print("\n--- RAG Ingestion Complete! ---")
    print("The knowledge base in MongoDB is now ready for this scenario.")


if __name__ == "__main__":
    main()
