from enum import Enum
from typing import Dict

from pydantic import BaseModel, Field


class ActionType(str, Enum):
    """Enumeration for the types of actions a character can take."""
    DIPLOMACY = "DIPLOMACY"
    MILITARY = "MILITARY"
    ESPIONAGE = "ESPIONAGE"
    ECONOMIC = "ECONOMIC"


class Action(BaseModel):
    """
    Represents a single, concrete action submitted by a character in a round.
    This is the primary output of a delegate agent and input for the judge agent.
    """
    character_id: str = Field(description="The ID of the character performing the action.")
    reasoning: str = Field(description="The character's in-world justification for taking this action.")
    action_type: ActionType = Field(description="The category of the action.")
    action_details: str = Field(description="A clear, specific description of the action being taken.")
    resource_cost: Dict[str, int] = Field(description="A dictionary of resources to be spent on this action.",
                                          default_factory=dict)
