from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from philoagents.application.game_loop_service.service import GameLoopService
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
    is_processing_round: bool = False


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


class SessionResponse(BaseModel):
    """Which character (if any) the current saved game is bound to."""

    player_character_id: str | None
    player_character_name: str | None


class StartGameRequest(BaseModel):
    character_id: str


class ScoreDetails(BaseModel):
    name: str
    faction_score: int
    undergame_score: int
    total_score: int


class ScoreboardResponse(BaseModel):
    scores: Dict[str, ScoreDetails]
    actual_undergame: str


# --- API Endpoints ---


@router.get("/session", response_model=SessionResponse)
async def get_session(service: GameLoopService = Depends(get_game_service)):
    """
    Returns which character the current saved game is bound to, so the UI can
    offer "Continue as X" instead of a fresh character selection.
    """
    state = service.get_current_state()
    player_id = state.player_character_id
    return SessionResponse(
        player_character_id=player_id,
        player_character_name=state.characters[player_id].name if player_id else None,
    )


@router.post("/start")
async def start_game(
    request: StartGameRequest, service: GameLoopService = Depends(get_game_service)
):
    """
    Binds the human player to a character for the current game. Rejects the
    binding with 409 when a game bound to another character is in progress.
    """
    try:
        service.start_game(request.character_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"message": f"Game started as '{request.character_id}'."}


@router.get("/status/{character_id}", response_model=GameStatusResponse)
async def get_game_status(
    character_id: str, service: GameLoopService = Depends(get_game_service)
):
    """
    Endpoint for the player's UI to get the current state of the game
    from their character's perspective. Only the character the game is bound
    to may be queried, so one seat cannot read another seat's private intel.
    """
    current_state = service.get_current_state()
    if character_id not in current_state.characters:
        raise HTTPException(
            status_code=404, detail=f"Character '{character_id}' not found."
        )
    player_id = current_state.player_character_id
    if player_id is not None and character_id != player_id:
        raise HTTPException(
            status_code=403,
            detail=f"This game is bound to '{player_id}'.",
        )

    player_char = current_state.characters[character_id]
    other_chars = [
        char.name
        for cid, char in current_state.characters.items()
        if cid != character_id
    ]

    return GameStatusResponse(
        round_number=current_state.round_number,
        crisis_update=current_state.crisis_update,
        your_character=player_char,
        other_characters=other_chars,
        known_intel=player_char.known_intel,
        is_game_over=service.is_game_over,
        is_processing_round=service.is_processing_round,
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
    except ValueError as e:
        # If the action was already accepted but no round is being processed,
        # a previous resolution attempt failed. Re-trigger it instead of
        # dead-ending the player; the round lock makes this safe.
        if (
            action.character_id in service.submitted_actions
            and not service.is_processing_round
        ):
            background_tasks.add_task(service.advance_round)
            return {"message": "Action already received. Retrying round resolution."}
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger the rest of the round to process in the background.
    # This makes the API return instantly, providing a better user experience.
    background_tasks.add_task(service.advance_round)

    return {
        "message": "Action received. The round is now being processed by all delegates."
    }


@router.post("/reset")
async def reset_game(service: GameLoopService = Depends(get_game_service)):
    """
    Resets the game to the initial scenario state and clears any persisted progress.
    """
    try:
        service.reset()
        return {"message": "Game has been reset to the initial scenario state."}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/end", response_model=ScoreboardResponse)
async def end_game(
    request: EndGameRequest, service: GameLoopService = Depends(get_game_service)
):
    """
    Receives the player's final Undergame guess, triggers the final scoring for
    all players, and returns the complete scoreboard.

    The guess is locked in on the first call, so this endpoint cannot be
    replayed with different guesses to fish for a higher score.
    """
    try:
        raw_scores, actual_undergame = await service.finalize_scores(
            player_character_id=request.player_character_id,
            undergame_guess=request.undergame_guess,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    formatted_scores = {
        char_id: ScoreDetails(**score_data)
        for char_id, score_data in raw_scores.items()
    }
    return ScoreboardResponse(
        scores=formatted_scores, actual_undergame=actual_undergame
    )
