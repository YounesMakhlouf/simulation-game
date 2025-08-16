from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.application.scoring_service import ScoringService
from philoagents.domain import Action, Character, CharacterFactory
from philoagents.infrastructure.dependencies import (
    get_character_factory,
    get_game_service,
)

router = APIRouter(
    prefix="/game",
    tags=["Game Loop"],
)


# --- Pydantic Models for API ---
class GameStatusResponse(BaseModel):
    round_number: int
    crisis_update: str
    your_character: Character
    other_characters: list[str]
    known_intel: list[str]
    is_game_over: bool


class EndGameRequest(BaseModel):
    player_character_id: str
    undergame_guess: str


class CharacterProfile(BaseModel):
    """A simplified character model for the selection screen."""

    id: str
    name: str
    title: str
    description: str
    portrait_key: str


class CharacterListResponse(BaseModel):
    characters: list[CharacterProfile]


class EndGameRequest(BaseModel):
    player_character_id: str
    undergame_guess: str


class ScoreDetails(BaseModel):
    name: str
    faction_score: int
    undergame_score: int
    total_score: int


class ScoreboardResponse(BaseModel):
    scores: Dict[str, ScoreDetails]
    actual_undergame: str


# --- API Endpoints ---


@router.get("/status/{character_id}", response_model=GameStatusResponse)
async def get_game_status(
    character_id: str, service: GameLoopService = Depends(get_game_service)
):
    """
    Endpoint for the player's UI to get the current state of the game
    from their character's perspective.
    """
    current_state = service.get_current_state()
    if character_id not in current_state.characters:
        raise HTTPException(
            status_code=404, detail=f"Character '{character_id}' not found."
        )

    player_char = current_state.characters[character_id]
    other_chars = [
        name
        for cid, char in current_state.characters.items()
        if cid != character_id
        for name in [char.name]
    ]

    return GameStatusResponse(
        round_number=current_state.round_number,
        crisis_update=current_state.crisis_update,
        your_character=player_char,
        other_characters=other_chars,
        known_intel=player_char.known_intel,
        is_game_over=service.is_game_over,
    )


@router.get("/characters", response_model=CharacterListResponse)
async def get_all_characters(
    factory: CharacterFactory = Depends(get_character_factory),
):
    """
    Returns a list of all playable characters in the current scenario
    with the specific profile data needed for the character selection screen.
    """
    character_ids = factory.get_available_character_ids()

    profiles = []
    for char_id in character_ids:
        # Get the original, raw dictionary for this character
        raw_data = factory.get_character_raw_data(char_id)
        ui_profile_data = raw_data.get("ui_profile", {})

        profiles.append(
            CharacterProfile(
                id=raw_data.get("id"),
                name=raw_data.get("name"),
                title=ui_profile_data.get("title", "No Title Available"),
                description=ui_profile_data.get(
                    "description", "No Description Available"
                ),
                portrait_key=ui_profile_data.get("portrait_key", "default_portrait"),
            )
        )

    return CharacterListResponse(characters=profiles)


@router.post("/action", status_code=202)
async def submit_action(
    action: Action,
    background_tasks: BackgroundTasks,
    service: GameLoopService = Depends(get_game_service),
):
    """
    Endpoint for the human player to submit their official action for the round.
    This triggers the AI players and the Judge to process the round in the background.
    """
    try:
        # Submit the human player's action first
        service.submit_player_action(action)

        # Trigger the rest of the round to process in the background.
        # This makes the API return instantly, providing a better user experience.
        background_tasks.add_task(service.advance_round)

        return {
            "message": "Action received. The round is now being processed by all delegates."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/end", response_model=ScoreboardResponse)
async def end_game(
    request: EndGameRequest, service: GameLoopService = Depends(get_game_service)
):
    """
    Receives the player's final Undergame guess, triggers the final scoring for
    all players, and returns the complete scoreboard.
    """
    if not service.is_game_over:
        raise HTTPException(
            status_code=400,
            detail="The game is not over yet. This endpoint cannot be called.",
        )

    # --- 1. Gather Guesses ---
    # The human player's guess comes from the request.
    # For this simulation, we'll generate simple placeholder guesses for the AI.
    # TODO: In a more advanced version, have a final "guess_undergame" agent or have the AIs guess the undergame at each step (internally).
    undergame_guesses = {request.player_character_id: request.undergame_guess}
    ai_characters = [
        char
        for char_id, char in service.game_state.characters.items()
        if char_id != request.player_character_id
    ]
    for ai_char in ai_characters:
        # Simple placeholder logic for AI guesses
        if "genius" in ai_char.id or "scipio" in ai_char.id:
            undergame_guesses[ai_char.id] = (
                "I believe a supernatural force rewarded audacity, but it came at a price."
            )
        else:
            undergame_guesses[ai_char.id] = (
                "The events were simply the result of political maneuvering."
            )

    # --- 2. Get Final Game State ---
    all_characters_final_state = list(service.game_state.characters.values())

    # --- 3. Calculate Scores ---
    scoring_service = ScoringService()
    raw_scores = scoring_service.calculate_final_scores(
        characters=all_characters_final_state,
        undergame_guesses=undergame_guesses,
        actual_undergame=service.undergame_plot,
    )

    # Convert raw scores to ScoreDetails format
    formatted_scores = {}
    for char_id, score_data in raw_scores.items():
        formatted_scores[char_id] = ScoreDetails(
            name=score_data["name"],
            faction_score=score_data["faction_score"],
            undergame_score=score_data["undergame_score"],
            total_score=score_data["total_score"],
        )

    # --- 4. Return the complete scoreboard ---
    return ScoreboardResponse(
        scores=formatted_scores, actual_undergame=service.undergame_plot
    )
