from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field


class UpdatedCharacterState(BaseModel):
    """
    Defines the complete, updated state for a single character after a round.
    """
    character_id: str = Field(
        description="The ID of the character whose state is being updated."
    )
    resources: Dict[str, int] = Field(
        description="The character's new, updated dictionary of consumable numerical resources."
    )
    statuses: Dict[str, Union[str, int, bool]] = Field(
        description="The character's new, updated dictionary of descriptive statuses."
    )

class VictoryPointAward(BaseModel):
    character_id: str
    points_awarded: int
    reason: str


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
    updated_character_states: List[UpdatedCharacterState] = Field(
        description="A list containing the complete, updated state (resources and statuses) for EVERY character in the game."
    )
    private_intel_reports: Optional[List[PrivateIntel]] = Field(
        default=None,
        description="A list of secret reports for specific players, generated from successful espionage actions.",
    )
    victory_point_awards: Optional[List[VictoryPointAward]] = Field(
        default=None, description="A list of VP awards for the round."
    )

