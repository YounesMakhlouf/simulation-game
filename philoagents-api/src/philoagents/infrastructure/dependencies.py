# This file is for creating and providing shared, singleton instances of services, factories, and other dependencies.
from functools import lru_cache

from loguru import logger

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings
from philoagents.domain.character_factory import CharacterFactory
from philoagents.infrastructure.mongo import GameStateRepository


@lru_cache
def _get_scenario_loader() -> ScenarioLoader:
    logger.info(f"Loading scenario from: {settings.SCENARIO_PATH}")
    return ScenarioLoader(scenario_path=settings.SCENARIO_PATH)


@lru_cache
def get_character_factory() -> CharacterFactory:
    """A FastAPI dependency that provides the singleton CharacterFactory instance."""
    return _get_scenario_loader().create_character_factory()


@lru_cache
def get_game_service() -> GameLoopService:
    """A FastAPI dependency that provides the singleton GameLoopService instance."""
    loader = _get_scenario_loader()
    service = GameLoopService(
        initial_state=loader.create_initial_game_state(),
        undergame_plot=loader.get_undergame_plot(),
        factory=get_character_factory(),
        undergame_plot_display=loader.get_undergame_plot_for_display(),
        state_repository=GameStateRepository(),
    )
    if not service.try_resume():
        logger.info("No saved game found; starting a new game.")
    logger.info(f"Game service initialized for scenario: '{loader.manifest['name']}'")
    return service
