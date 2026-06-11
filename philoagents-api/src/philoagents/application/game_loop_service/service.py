import asyncio
from typing import Dict, List, Optional

from loguru import logger
from opik.integrations.langchain import OpikTracer

from philoagents.application.game_loop_service.workflow.graph import (
    create_action_graph,
    create_judge_graph,
)
from philoagents.config import settings
from philoagents.domain import Action, Character, CharacterFactory
from philoagents.domain.action import ActionType
from philoagents.domain.game_state import GameState
from philoagents.domain.resources import PrivateIntel, VictoryPointAward
from philoagents.infrastructure.mongo import GameStateRepository


class GameLoopService:
    """
    Orchestrates the main turn-based game loop for the simulation.

    This class holds the master game state, collects actions from all players
    (human and AI), invokes the AI Judge to resolve the round, and updates
    the state for the next turn.
    """

    def __init__(
        self,
        initial_state: GameState,
        undergame_plot: str,
        factory: CharacterFactory,
        undergame_plot_display: str,
        max_rounds: int = 4,  # TODO: increase after we're done testing. Needs higher model limits
        state_repository: Optional[GameStateRepository] = None,
    ):
        self.game_state = initial_state
        self._initial_state = initial_state.model_copy(deep=True)
        self.undergame_plot = undergame_plot
        self.undergame_plot_display = undergame_plot_display
        self.factory = factory
        self.submitted_actions: Dict[str, Action] = {}
        self.max_rounds = max_rounds
        self.is_game_over = False
        self.state_repository = state_repository
        self._round_lock = asyncio.Lock()
        self.is_processing_round = False

    def try_resume(self) -> bool:
        """
        Restores the last persisted game state, if any.

        Returns:
            True when a saved game was loaded, False when starting fresh.
        """
        if self.state_repository is None:
            return False

        saved_state = self.state_repository.load()
        if saved_state is None:
            return False

        self.game_state = saved_state
        self.is_game_over = saved_state.round_number > self.max_rounds
        logger.info(
            f"Resumed saved game at round {saved_state.round_number} "
            f"(game over: {self.is_game_over})."
        )
        return True

    def reset(self) -> GameState:
        """
        Resets the game to the initial scenario state and clears any persisted progress.
        """
        if self.is_processing_round:
            raise RuntimeError("Cannot reset the game while a round is being resolved.")

        self.game_state = self._initial_state.model_copy(deep=True)
        self.submitted_actions = {}
        self.is_game_over = False
        if self.state_repository is not None:
            self.state_repository.clear()
        logger.info("Game state reset to the initial scenario state.")
        return self.get_current_state()

    def get_current_state(self) -> GameState:
        """Returns a copy of the current game state."""
        return self.game_state.model_copy(deep=True)

    def submit_player_action(self, action: Action):
        """
        Receives and stores an action from a player (typically the human player via an API).
        """
        if self.is_game_over:
            raise ValueError("The game is over; no more actions can be submitted.")
        if self.is_processing_round:
            raise ValueError(
                "The current round is being resolved. Please wait for the next round."
            )
        if action.character_id not in self.game_state.characters:
            raise ValueError(
                f"Character with ID '{action.character_id}' does not exist."
            )
        if action.character_id in self.submitted_actions:
            raise ValueError("Character has already submitted an action this round.")

        logger.info(
            f"Action received from: {self.game_state.characters[action.character_id].name}"
        )
        self.submitted_actions[action.character_id] = action

    def _deliver_private_intel(self, private_reports: Optional[List[PrivateIntel]]):
        """
        Appends new intelligence reports to the appropriate characters' state.
        """
        if not private_reports:
            return

        logger.info(
            f"Delivering {len(private_reports)} private intelligence reports..."
        )
        for report in private_reports:
            recipient_id = report.recipient_id
            if recipient_id in self.game_state.characters:
                self.game_state.characters[recipient_id].known_intel.append(
                    report.report
                )
            else:
                logger.warning(
                    f"Could not deliver intel to non-existent character ID: {recipient_id}"
                )

    def _apply_victory_points(self, vp_awards: Optional[List[VictoryPointAward]]):
        if not vp_awards:
            return
        for award in vp_awards:
            if award.character_id in self.game_state.characters:
                self.game_state.characters[
                    award.character_id
                ].victory_points += award.points_awarded
                logger.info(
                    f"Awarded {award.points_awarded} VP to {award.character_id} for: {award.reason}"
                )

    def _fallback_action(self, character: Character) -> Action:
        """
        A safe default action used when an AI delegate fails to produce one in time,
        so a single failing agent cannot stall the whole round.
        """
        return Action(
            character_id=character.id,
            reasoning="The delegate failed to issue orders in time.",
            action_type=ActionType.DIPLOMACY,
            action_details=(
                f"{character.name} holds position and maintains their current posture this round."
            ),
            resource_cost={},
        )

    async def _run_ai_delegate_turns(self) -> List[Action]:
        """
        Invokes the action agent for all AI characters concurrently.
        """
        ai_characters = [
            char
            for char_id, char in self.game_state.characters.items()
            if char_id not in self.submitted_actions
        ]

        async def get_single_action(character: Character) -> Action:
            graph_builder = create_action_graph()
            graph = graph_builder.compile()
            opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
            thread_id = f"{character.id}-action-round-{self.game_state.round_number}"
            config = {
                "configurable": {"thread_id": thread_id},
                "callbacks": [opik_tracer],
            }

            dossier_entries = []
            all_characters = self.game_state.characters
            for char_id, other_char in all_characters.items():
                if other_char.id != character.id:
                    entry = f"- **{other_char.name}**\n  Reputation: {other_char.perspective}"
                    dossier_entries.append(entry)

            other_players_dossier = "\n".join(dossier_entries)
            initial_state = {
                "character": character,
                "crisis_update": self.game_state.crisis_update,
                "other_players_dossier": other_players_dossier,
            }
            result = await graph.ainvoke(input=initial_state, config=config)
            return result["action"]

        async def get_action_with_fallback(character: Character) -> Action:
            try:
                return await asyncio.wait_for(
                    get_single_action(character),
                    timeout=settings.AI_ACTION_TIMEOUT_SECONDS,
                )
            except Exception as e:
                logger.error(
                    f"AI delegate '{character.id}' failed to produce an action, "
                    f"using fallback: {e}"
                )
                return self._fallback_action(character)

        tasks = [get_action_with_fallback(char) for char in ai_characters]
        ai_actions = await asyncio.gather(*tasks)
        return ai_actions

    async def _run_judge_turn(
        self, all_actions: List[Action]
    ) -> tuple[
        str,
        Dict[str, Character],
        Optional[List[PrivateIntel]],
        Optional[List[VictoryPointAward]],
    ]:
        """
        Invokes the judge agent to resolve the round.
        """
        graph_builder = create_judge_graph()
        graph = graph_builder.compile()
        opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
        thread_id = f"judge-resolution-round-{self.game_state.round_number}"
        config = {"configurable": {"thread_id": thread_id}, "callbacks": [opik_tracer]}
        current_state_json_str = self.game_state.model_dump_json(indent=2)
        initial_state = {
            "current_game_state_json": current_state_json_str,
            "actions": all_actions,
            "characters": self.game_state.characters,
            "undergame_plot": self.undergame_plot,
        }
        result = await asyncio.wait_for(
            graph.ainvoke(input=initial_state, config=config),
            timeout=settings.JUDGE_TIMEOUT_SECONDS,
        )

        return (
            result["crisis_update"],
            result["updated_characters"],
            result.get("private_intel_reports", None),
            result.get("victory_point_awards", None),
        )

    async def advance_round(self) -> GameState:
        """
        Executes the full logic to advance the game to the next round.

        Only one round can be processed at a time; concurrent calls are rejected.
        """
        if self._round_lock.locked():
            raise RuntimeError("A round is already being processed.")

        async with self._round_lock:
            self.is_processing_round = True
            try:
                return await self._advance_round()
            except Exception:
                logger.exception(
                    f"Failed to resolve round {self.game_state.round_number}."
                )
                raise
            finally:
                self.is_processing_round = False

    async def _advance_round(self) -> GameState:
        logger.info(f"--- Processing Round {self.game_state.round_number} ---")

        # 1. Get actions from all AI delegates
        ai_actions = await self._run_ai_delegate_turns()
        for action in ai_actions:
            self.submitted_actions[action.character_id] = action

        all_actions_for_round = list(self.submitted_actions.values())

        # 2. Resolve the round with the AI Judge
        (
            new_crisis_update,
            updated_characters,
            private_reports,
            victory_point_awards,
        ) = await self._run_judge_turn(all_actions_for_round)

        # 3. Update the master game state for the new round.
        self.game_state.round_number += 1
        self.game_state.crisis_update = new_crisis_update
        self.game_state.characters = updated_characters
        self.game_state.last_round_actions = all_actions_for_round
        self._deliver_private_intel(private_reports)
        self._apply_victory_points(victory_point_awards)

        # 4. Reset submitted actions for the next round
        self.submitted_actions = {}

        if self.state_repository is not None:
            self.state_repository.save(self.game_state)

        logger.info(f"--- Round {self.game_state.round_number} has begun! ---")
        if self.game_state.round_number > self.max_rounds:
            self.is_game_over = True
            logger.info("--- FINAL ROUND COMPLETE. GAME OVER. ---")
        return self.get_current_state()
