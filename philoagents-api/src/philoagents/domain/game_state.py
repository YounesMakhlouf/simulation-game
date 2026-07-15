from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from philoagents.domain import Action, Character


class GameState(BaseModel):
    """
    Represents the complete state of the simulation at a specific round.
    This is the central object that gets saved to and loaded from the database.
    """

    round_number: int = Field(
        default=1, description="The current round number of the simulation."
    )
    crisis_update: str = Field(
        description="The narrative text describing the current world situation."
    )
    characters: Dict[str, Character] = Field(
        description="A dictionary mapping character_id to their full Character object."
    )
    player_character_id: Optional[str] = Field(
        default=None,
        description=(
            "The character the human player controls, bound when the game "
            "starts. None until a character is chosen (or for saves predating "
            "this field)."
        ),
    )
    last_round_actions: Optional[List[Action]] = Field(default=None, description="...")
    player_undergame_guess: Optional[str] = Field(
        default=None,
        description=(
            "The human player's locked-in Undergame guess. Set once at game end."
        ),
    )
    ai_undergame_guesses: Optional[Dict[str, str]] = Field(
        default=None,
        description=(
            "The AI characters' locked-in Undergame guesses, keyed by character "
            "id. Generated once at game end so repeated scoring is stable."
        ),
    )
