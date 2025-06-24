import json
from enum import Enum
from pathlib import Path
from typing import Dict, List

from pydantic import BaseModel, Field


class CharacterExtract(BaseModel):
    """
    A class representing raw character data for the RAG ingestion pipeline.
    This points to the sources needed to build the character's knowledge base.
    """
    id: str = Field(description="A unique, machine-readable identifier for the character (e.g., 'metternich').")
    urls: List[str] = Field(
        description="List of source URLs (e.g., Wikipedia) with information about this historical figure.")

    @classmethod
    def from_json(cls, metadata_file: Path) -> list["CharacterExtract"]:
        """Loads a list of character data from a JSON file."""
        with open(metadata_file, "r") as f:
            character_data = json.load(f)
        return [cls(**character) for character in character_data]


class Character(BaseModel):
    """
    Represents an active character in the simulation, AI or human-controlled.
    This model holds the personality, motivations, and resources of a historical figure.
    """
    id: str = Field(description="Unique identifier for the character (e.g., 'metternich').")
    name: str = Field(description="The full name of the historical figure (e.g., 'Klemens von Metternich').")
    perspective: str = Field(
        description="A description of the character's core beliefs, political stance, and worldview.")
    style: str = Field(description="A description of the character's conversational and diplomatic style.")
    goals: str = Field(description="The primary objectives this character aims to achieve during the simulation.")
    resources: Dict[str, int] = Field(
        description="A dictionary of the character's starting resources (e.g., {'DiplomaticInfluence': 100, 'Spies': 5}).")

    def __str__(self) -> str:
        return f"Character(id={self.id}, name={self.name})"


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
