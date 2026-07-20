import asyncio
from typing import Dict, List, Optional

from loguru import logger
from opik.integrations.langchain import OpikTracer

from philoagents.application.game_loop_service.workflow.chains import (
    get_undergame_guess_chain,
)
from philoagents.application.game_loop_service.workflow.graph import (
    create_action_graph,
    create_judge_graph,
)
from philoagents.application.scoring_service import ScoringService
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

    async def reset(self) -> GameState:
        """
        Resets the game to the initial scenario state and clears any persisted progress.
        """
        if self.is_processing_round:
            raise RuntimeError("Cannot reset the game while a round is being resolved.")

        self.game_state = self._initial_state.model_copy(deep=True)
        self.submitted_actions = {}
        self.is_game_over = False
        if self.state_repository is not None:
            await self._persist(self.state_repository.clear)
        logger.info("Game state reset to the initial scenario state.")
        return self.get_current_state()

    def get_current_state(self) -> GameState:
        """Returns a copy of the current game state."""
        return self.game_state.model_copy(deep=True)

    @staticmethod
    async def _persist(repository_call, *args):
        """
        Runs a blocking repository call off the event loop, so a slow MongoDB
        cannot freeze every other request and open websocket.
        """
        return await asyncio.to_thread(repository_call, *args)

    async def start_game(self, character_id: str):
        """
        Binds the human player to a character for the current game.

        Idempotent for the already-bound character; switching characters
        mid-game requires a reset.

        Raises:
            ValueError: If the character does not exist.
            RuntimeError: If the game is already bound to another character.
        """
        if character_id not in self.game_state.characters:
            raise ValueError(f"Character '{character_id}' not found.")
        bound = self.game_state.player_character_id
        if bound is not None and bound != character_id:
            raise RuntimeError(
                f"A game is already in progress with "
                f"'{self.game_state.characters[bound].name}'. Reset the game "
                f"to play a different character."
            )
        if bound is None:
            self.game_state.player_character_id = character_id
            if self.state_repository is not None:
                await self._persist(self.state_repository.save, self.game_state)
            logger.info(f"Player bound to character '{character_id}'.")

    def _ensure_player_is(self, character_id: str):
        """
        Raises ValueError when the game is bound to a different character.
        Unbound games (saves predating the binding) accept any character.
        """
        bound = self.game_state.player_character_id
        if bound is not None and character_id != bound:
            raise ValueError(
                f"You are playing '{bound}' in this game; cannot act as "
                f"'{character_id}'."
            )

    async def finalize_scores(
        self, player_character_id: str, undergame_guess: str
    ) -> tuple[dict, str]:
        """
        Computes the final scoreboard for a finished game.

        All Undergame guesses (the player's, and one generated per AI
        character) are locked in and persisted on the first call, so replaying
        this endpoint cannot change the scores.

        Returns:
            A tuple of (raw scores keyed by character id, the displayable
            Undergame plot).

        Raises:
            ValueError: If the game is not over or the character is unknown.
        """
        if not self.is_game_over:
            raise ValueError("The game is not over yet; scores cannot be finalized.")
        if player_character_id not in self.game_state.characters:
            raise ValueError(f"Character '{player_character_id}' not found.")
        self._ensure_player_is(player_character_id)

        # Lock all guesses on first call; ignore later attempts to change them.
        if self.game_state.player_undergame_guess is None:
            self.game_state.player_undergame_guess = undergame_guess
            self.game_state.ai_undergame_guesses = await self._generate_ai_guesses(
                player_character_id
            )
            if self.state_repository is not None:
                await self._persist(self.state_repository.save, self.game_state)

        undergame_guesses = {
            player_character_id: self.game_state.player_undergame_guess,
            **(self.game_state.ai_undergame_guesses or {}),
        }

        # Embedding inference (and the first-call model load) is synchronous;
        # run it off the event loop so other requests aren't stalled.
        raw_scores = await asyncio.to_thread(
            ScoringService().calculate_final_scores,
            characters=list(self.game_state.characters.values()),
            undergame_guesses=undergame_guesses,
            actual_undergame=self.undergame_plot,
        )
        return raw_scores, self.undergame_plot_display

    async def _generate_ai_guesses(self, player_character_id: str) -> Dict[str, str]:
        """
        Asks each AI character for its theory of the Undergame, concurrently.
        A character that fails or times out falls back to a neutral guess.
        """
        ai_characters = [
            char
            for char_id, char in self.game_state.characters.items()
            if char_id != player_character_id
        ]
        guess_chain = get_undergame_guess_chain()

        async def guess_for(character: Character) -> str:
            try:
                return await asyncio.wait_for(
                    guess_chain.ainvoke(
                        {
                            "character_name": character.name,
                            "character_perspective": character.perspective,
                            "known_intel": "\n".join(character.known_intel) or "None.",
                            "crisis_update": self.game_state.crisis_update,
                        }
                    ),
                    timeout=settings.AI_ACTION_TIMEOUT_SECONDS,
                )
            except Exception as e:
                logger.error(f"Undergame guess failed for '{character.id}': {e}")
                return "The events were simply the result of political maneuvering."

        guesses = await asyncio.gather(*(guess_for(char) for char in ai_characters))
        return {char.id: guess for char, guess in zip(ai_characters, guesses)}

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
        self._ensure_player_is(action.character_id)
        if action.character_id in self.submitted_actions:
            raise ValueError("Character has already submitted an action this round.")
        self._validate_resource_cost(action)

        logger.info(
            f"Action received from: {self.game_state.characters[action.character_id].name}"
        )
        self.submitted_actions[action.character_id] = action

    def _validate_resource_cost(self, action: Action):
        """
        Rejects a submitted action whose declared cost is negative, names an
        unknown resource, or exceeds what the character currently has.
        """
        character = self.game_state.characters[action.character_id]
        for resource, amount in action.resource_cost.items():
            if amount < 0:
                raise ValueError(f"Resource cost for '{resource}' cannot be negative.")
            available = character.resources.get(resource)
            if available is None:
                raise ValueError(
                    f"Character '{action.character_id}' has no resource named "
                    f"'{resource}'."
                )
            if amount > available:
                raise ValueError(
                    f"Insufficient '{resource}': the action costs {amount} but "
                    f"only {available} is available."
                )

    def _charge_action_costs(self, actions: List[Action]) -> Dict[str, Character]:
        """
        Deducts each action's declared resource cost on a deep copy of the
        characters, so the game economy does not depend on the Judge LLM doing
        arithmetic and a failed round leaves the live state untouched.

        AI delegates can hallucinate costs, so unknown resources and negative
        amounts are dropped and overspends are clamped to zero instead of
        failing the round.
        """
        characters = {
            char_id: char.model_copy(deep=True)
            for char_id, char in self.game_state.characters.items()
        }
        for action in actions:
            character = characters.get(action.character_id)
            if character is None:
                continue
            for resource, amount in action.resource_cost.items():
                if resource not in character.resources or amount < 0:
                    logger.warning(
                        f"Ignoring invalid cost '{resource}: {amount}' declared "
                        f"by '{action.character_id}'."
                    )
                    continue
                remaining = character.resources[resource] - amount
                if remaining < 0:
                    logger.warning(
                        f"'{action.character_id}' cannot afford {amount} "
                        f"'{resource}'; clamping the balance to 0."
                    )
                    remaining = 0
                character.resources[resource] = remaining
        return characters

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
            if award.character_id not in self.game_state.characters:
                logger.warning(
                    f"Ignoring VP award for unknown character '{award.character_id}'."
                )
                continue
            points = max(0, min(award.points_awarded, settings.MAX_VP_AWARD_PER_ROUND))
            if points != award.points_awarded:
                logger.warning(
                    f"Judge awarded {award.points_awarded} VP to "
                    f"'{award.character_id}'; clamped to {points}."
                )
            self.game_state.characters[award.character_id].victory_points += points
            logger.info(
                f"Awarded {points} VP to {award.character_id} for: {award.reason}"
            )

    def _fallback_action(self, character: Character) -> Action:
        """
        A safe default action used when an AI delegate fails to produce one in time,
        so a single failing agent cannot stall the whole round.
        """
        return Action(
            character_id=character.id,
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
            opik_tracer = OpikTracer(
                graph=graph.get_graph(xray=True), project_name=settings.COMET_PROJECT
            )
            thread_id = f"{character.id}-action-round-{self.game_state.round_number}"
            config = {
                "configurable": {"thread_id": thread_id},
                "callbacks": [opik_tracer],
            }

            dossier_entries = []
            all_characters = self.game_state.characters
            for char_id, other_char in all_characters.items():
                if other_char.id != character.id:
                    entry = f"- **{other_char.name}**\n  Perspective: {other_char.perspective}"
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
        self, all_actions: List[Action], characters: Dict[str, Character]
    ) -> tuple[
        str,
        Dict[str, Character],
        Optional[List[PrivateIntel]],
        Optional[List[VictoryPointAward]],
    ]:
        """
        Invokes the judge agent to resolve the round.

        `characters` is the settled (post-payment) character map: action costs
        have already been deducted deterministically, and the judge sees that
        state as the authoritative one.
        """
        graph_builder = create_judge_graph()
        graph = graph_builder.compile()
        opik_tracer = OpikTracer(
            graph=graph.get_graph(xray=True), project_name=settings.COMET_PROJECT
        )
        thread_id = f"judge-resolution-round-{self.game_state.round_number}"
        config = {"configurable": {"thread_id": thread_id}, "callbacks": [opik_tracer]}
        state_for_judge = self.game_state.model_copy(deep=True)
        state_for_judge.characters = characters
        # Keep the judge's input lean: last_round_actions duplicates what the
        # judge already saw, and the prompt grows each round — a bloated state
        # JSON blows the per-minute token limit on free-tier Groq. known_intel
        # only ever grows and the judge writes intel rather than reading it,
        # so past reports are excluded too.
        current_state_json_str = state_for_judge.model_dump_json(
            exclude={
                "last_round_actions": True,
                "player_undergame_guess": True,
                "ai_undergame_guesses": True,
                "characters": {"__all__": {"known_intel"}},
            }
        )
        initial_state = {
            "current_game_state_json": current_state_json_str,
            "actions": all_actions,
            "characters": characters,
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

        # 2. Pay declared action costs deterministically (on a copy, so a
        # failed round stays retriable), then resolve with the AI Judge.
        settled_characters = self._charge_action_costs(all_actions_for_round)
        (
            new_crisis_update,
            updated_characters,
            private_reports,
            victory_point_awards,
        ) = await self._run_judge_turn(all_actions_for_round, settled_characters)

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
            await self._persist(self.state_repository.save, self.game_state)

        logger.info(f"--- Round {self.game_state.round_number} has begun! ---")
        if self.game_state.round_number > self.max_rounds:
            self.is_game_over = True
            logger.info("--- FINAL ROUND COMPLETE. GAME OVER. ---")
        return self.get_current_state()
