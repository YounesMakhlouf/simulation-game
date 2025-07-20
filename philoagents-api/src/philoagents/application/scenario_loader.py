# in philoagents/application/scenario_loader.py

import json
from pathlib import Path
from typing import Dict, List, Union

# Import the necessary domain models and factory
from philoagents.domain.character_factory import CharacterFactory
from philoagents.domain.game_state import GameState


class ScenarioLoader:
    """
    Loads all necessary data for a specific historical scenario from a directory.
    """
    def __init__(self, scenario_path: Union[str, Path]):
        """
        Initializes the loader by reading all configuration files from the scenario path.

        Args:
            scenario_path: The file path to the scenario pack directory. Can be a string or a pathlib.Path object.
        """
        base_path = Path("philoagents")
        self.path = base_path / scenario_path
        if not self.path.is_dir():
            raise FileNotFoundError(f"Scenario directory not found at: {self.path}")

        # 1. Load the manifest.json
        manifest_path = self.path / "manifest.json"
        with open(manifest_path, 'r') as f:
            self.manifest = json.load(f)

        # 2. Load characters.json
        character_file = self.path / self.manifest['character_data_file']
        with open(character_file, 'r') as f:
            self.character_data = json.load(f)

        # 3. Load initial_state.json
        initial_state_file = self.path / self.manifest['initial_state_file']
        with open(initial_state_file, 'r') as f:
            self.initial_state_data = json.load(f)

        # 4. Load rag_sources.json
        rag_sources_file = self.path / self.manifest['rag_sources_file']
        with open(rag_sources_file, 'r') as f:
            self.rag_sources_data = json.load(f)

        print(f"Successfully loaded scenario '{self.manifest['name']}'")

    def get_undergame_plot(self) -> str:
        """Returns the secret undergame plot for the scenario."""
        return self.manifest['undergame_plot']

    def get_rag_sources(self) -> List[Dict]:
        """Returns the list of RAG sources for the scenario."""
        return self.rag_sources_data

    def create_character_factory(self) -> CharacterFactory:
        """Creates a CharacterFactory instance initialized with the scenario's characters."""
        return CharacterFactory(self.character_data)

    def create_initial_game_state(self) -> GameState:
        """
        Constructs the initial GameState object for the start of the simulation.
        """
        factory = self.create_character_factory()

        # This is a cleaner way to get all characters from the new factory
        initial_characters = {
            char.id: char for char in factory.get_all_characters()
        }

        return GameState(
            round_number=self.initial_state_data['round_number'],
            crisis_update=self.initial_state_data['crisis_update'],
            characters=initial_characters
        )