# This file is for creating and providing shared, singleton instances of services, factories, and other dependencies.

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings
from philoagents.domain.character_factory import CharacterFactory

# --- SINGLETON INSTANTIATION (happens once on startup) ---

print(f"Loading scenario from: {settings.SCENARIO_PATH}")
scenario_loader = ScenarioLoader(scenario_path=settings.SCENARIO_PATH)

character_factory_instance = scenario_loader.create_character_factory()

initial_game_state = scenario_loader.create_initial_game_state()
undergame_plot = scenario_loader.get_undergame_plot()
game_service_instance = GameLoopService(initial_state=initial_game_state, undergame_plot=undergame_plot,
                                        factory=character_factory_instance)
print(f"Game service initialized for scenario: '{scenario_loader.manifest['name']}'")


# --- DEPENDENCY INJECTION PROVIDER FUNCTIONS ---

def get_character_factory() -> CharacterFactory:
    """A FastAPI dependency that provides the singleton CharacterFactory instance."""
    return character_factory_instance


def get_game_service() -> GameLoopService:
    """A FastAPI dependency that provides the singleton GameLoopService instance."""
    return game_service_instance
