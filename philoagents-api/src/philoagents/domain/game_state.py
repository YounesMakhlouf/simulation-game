from typing import List, Dict, Optional

from pydantic import BaseModel, Field

from philoagents.domain import Character, Action


class GameState(BaseModel):
    """
    Represents the complete state of the simulation at a specific round.
    This is the central object that gets saved to and loaded from the database.
    """
    round_number: int = Field(default=1, description="The current round number of the simulation.")
    crisis_update: str = Field(description="The narrative text describing the current world situation.")
    characters: Dict[str, Character] = Field(
        description="A dictionary mapping character_id to their full Character object.")
    last_round_actions: Optional[List[Action]] = Field(default=None, description="...")
