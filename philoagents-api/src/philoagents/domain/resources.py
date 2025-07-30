from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class UpdatedResource(BaseModel):
    """Defines the structure for a single character's updated resources."""

    character_id: str = Field(
        description="The ID of the character whose resources are being updated."
    )
    resources: Dict[str, int] = Field(
        description="The new resource dictionary for the character."
    )


class PrivateIntel(BaseModel):
    """
    Represents a piece of secret information delivered to a single character.
    """

    recipient_id: str = Field(
        description="The ID of the character who should receive this report."
    )
    report: str = Field(
        description="The content of the intelligence report. Should be concise and actionable."
    )


class JudgeOutput(BaseModel):
    """The expected JSON output structure from the Judge LLM."""

    crisis_update: str = Field(description="The narrative update for the next round.")
    updated_resources: List[UpdatedResource] = Field(
        description="A list of all characters with their updated resources."
    )
    private_intel_reports: Optional[List[PrivateIntel]] = Field(
        default=None,
        description="A list of secret reports for specific players, generated from successful espionage actions.",
    )
