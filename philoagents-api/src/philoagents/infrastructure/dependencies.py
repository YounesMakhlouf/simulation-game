# This file is for creating and providing shared, singleton instances of services, factories, and other dependencies.

from loguru import logger

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings
from philoagents.domain.character_factory import CharacterFactory
from philoagents.infrastructure.mongo import GameStateRepository

# --- SINGLETON INSTANTIATION (happens once on startup) ---

logger.info(f"Loading scenario from: {settings.SCENARIO_PATH}")
scenario_loader = ScenarioLoader(scenario_path=settings.SCENARIO_PATH)

character_factory_instance = scenario_loader.create_character_factory()

initial_game_state = scenario_loader.create_initial_game_state()
undergame_plot = scenario_loader.get_undergame_plot()
undergame_plot_display = scenario_loader.get_undergame_plot_for_display()
game_state_repository = GameStateRepository()
game_service_instance = GameLoopService(
    initial_state=initial_game_state,
    undergame_plot=undergame_plot,
    factory=character_factory_instance,
    undergame_plot_display=undergame_plot_display,
    state_repository=game_state_repository,
)
if not game_service_instance.try_resume():
    logger.info("No saved game found; starting a new game.")
logger.info(
    f"Game service initialized for scenario: '{scenario_loader.manifest['name']}'"
)


# --- DEPENDENCY INJECTION PROVIDER FUNCTIONS ---


def get_character_factory() -> CharacterFactory:
    """A FastAPI dependency that provides the singleton CharacterFactory instance."""
    return character_factory_instance


def get_game_service() -> GameLoopService:
    """A FastAPI dependency that provides the singleton GameLoopService instance."""
    return game_service_instance
