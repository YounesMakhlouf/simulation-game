from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field


class ResourceChange(BaseModel):
    """
    A single outcome-based gain or loss of one resource for one character.
    The game engine applies these deltas; the Judge never computes balances.
    """

    character_id: str = Field(
        description="The ID of the character whose resource changes."
    )
    resource: str = Field(description="The name of the resource that changes.")
    change: int = Field(
        description="The delta to apply: positive for a gain, negative for a loss."
    )
    reason: str = Field(
        description="A brief in-world justification for this gain or loss."
    )


class CharacterStatusUpdate(BaseModel):
    """
    The complete, updated set of descriptive statuses for one character.
    """

    character_id: str = Field(
        description="The ID of the character whose statuses are being updated."
    )
    statuses: Dict[str, Union[str, int, bool]] = Field(
        description="The character's new, complete dictionary of descriptive statuses."
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
    resource_changes: List[ResourceChange] = Field(
        default_factory=list,
        description=(
            "Outcome-based resource gains and losses from this round's "
            "resolution. Do NOT restate balances and do NOT re-deduct declared "
            "action costs; only list what changed as a consequence of outcomes."
        ),
    )
    status_updates: List[CharacterStatusUpdate] = Field(
        default_factory=list,
        description=(
            "The new, complete status dictionary for each character whose "
            "statuses changed this round. Characters not listed keep their "
            "current statuses."
        ),
    )
    private_intel_reports: Optional[List[PrivateIntel]] = Field(
        default=None,
        description="A list of secret reports for specific players, generated from successful espionage actions.",
    )
    victory_point_awards: Optional[List[VictoryPointAward]] = Field(
        default=None, description="A list of VP awards for the round."
    )
