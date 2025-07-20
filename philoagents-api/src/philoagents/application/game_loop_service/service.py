import asyncio
from typing import Dict, List

from opik.integrations.langchain import OpikTracer

from philoagents.application.game_loop_service.workflow.graph import create_action_graph, create_judge_graph
from philoagents.domain import Action, Character, CharacterFactory
from philoagents.domain.game_state import GameState


class GameLoopService:
    """
    Orchestrates the main turn-based game loop for the simulation.

    This class holds the master game state, collects actions from all players
    (human and AI), invokes the AI Judge to resolve the round, and updates
    the state for the next turn.
    """

    def __init__(self, initial_state: GameState, undergame_plot: str, factory: CharacterFactory):
        self.game_state = initial_state
        self.undergame_plot = undergame_plot
        self.factory = factory
        self.submitted_actions: Dict[str, Action] = {}

    def get_current_state(self) -> GameState:
        """Returns a copy of the current game state."""
        return self.game_state.model_copy(deep=True)

    def submit_player_action(self, action: Action):
        """
        Receives and stores an action from a player (typically the human player via an API).
        """
        if action.character_id not in self.game_state.characters:
            raise ValueError(f"Character with ID '{action.character_id}' does not exist.")
        if action.character_id in self.submitted_actions:
            raise ValueError("Character has already submitted an action this round.")

        print(f"Action received from: {self.game_state.characters[action.character_id].name}")
        self.submitted_actions[action.character_id] = action

    async def _run_ai_delegate_turns(self) -> List[Action]:
        """
        Invokes the action agent for all AI characters concurrently.
        """
        ai_characters = [char for char_id, char in self.game_state.characters.items() if
                         char_id not in self.submitted_actions]

        async def get_single_action(character: Character):
            graph_builder = create_action_graph()
            graph = graph_builder.compile()
            opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
            thread_id = f"{character.id}-action-round-{self.game_state.round_number}"
            config = {"configurable": {"thread_id": thread_id}, "callbacks": [opik_tracer]}

            dossier_entries = []
            all_characters = self.game_state.characters
            for char_id, other_char in all_characters.items():
                if other_char.id != character.id:
                    entry = f"- **{other_char.name}**\n  Reputation: {other_char.perspective}"
                    dossier_entries.append(entry)

            other_players_dossier = "\n".join(dossier_entries)
            initial_state = {"character": character, "crisis_update": self.game_state.crisis_update,
                             "other_players_dossier": other_players_dossier, }
            result = await graph.ainvoke(input=initial_state, config=config)
            return result['action']

        tasks = [get_single_action(char) for char in ai_characters]
        ai_actions = await asyncio.gather(*tasks)
        return ai_actions

    async def _run_judge_turn(self, all_actions: List[Action]) -> tuple[str, Dict[str, Character]]:
        """
        Invokes the judge agent to resolve the round.
        """
        graph_builder = create_judge_graph()
        graph = graph_builder.compile()
        opik_tracer = OpikTracer(graph=graph.get_graph(xray=True))
        thread_id = f"judge-resolution-round-{self.game_state.round_number}"
        config = {"configurable": {"thread_id": thread_id}, "callbacks": [opik_tracer]}

        initial_state = {"actions": all_actions, "characters": self.game_state.characters,
                         "undergame_plot": self.undergame_plot, }
        result = await graph.ainvoke(input=initial_state, config=config)

        return result['crisis_update'], result['updated_characters']

    async def advance_round(self) -> GameState:
        """
        Executes the full logic to advance the game to the next round.
        """
        print(f"\n--- Processing Round {self.game_state.round_number} ---")

        # 1. Get actions from all AI delegates
        ai_actions = await self._run_ai_delegate_turns()
        for action in ai_actions:
            self.submitted_actions[action.character_id] = action

        all_actions_for_round = list(self.submitted_actions.values())

        # 2. Resolve the round with the AI Judge
        new_crisis_update, updated_characters = await self._run_judge_turn(all_actions_for_round)

        # 3. Update the master game state for the new round
        self.game_state.round_number += 1
        self.game_state.crisis_update = new_crisis_update
        self.game_state.characters = updated_characters
        self.game_state.last_round_actions = all_actions_for_round

        # 4. Reset submitted actions for the next round
        self.submitted_actions = {}

        print(f"\n--- Round {self.game_state.round_number} has begun! ---")
        return self.get_current_state()
