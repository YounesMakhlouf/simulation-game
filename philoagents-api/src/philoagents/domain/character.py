import json
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
    known_intel: List[str] = Field(default_factory=list,
        description="A list of intelligence reports this character has received.")

    def __str__(self) -> str:
        return f"Character(id={self.id}, name={self.name})"
