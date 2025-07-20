from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.domain import Character, CharacterFactory, Action
from philoagents.infrastructure.dependencies import get_character_factory, get_game_service

router = APIRouter(prefix="/game", tags=["Game Loop"], )


# --- Pydantic Models for API ---
class GameStatusResponse(BaseModel):
    round_number: int
    crisis_update: str
    your_character: Character
    other_characters: list[str]
    known_intel: list[str]


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


# --- API Endpoints ---

@router.get("/status/{character_id}", response_model=GameStatusResponse)
async def get_game_status(character_id: str, service: GameLoopService = Depends(get_game_service)):
    """
    Endpoint for the player's UI to get the current state of the game
    from their character's perspective.
    """
    current_state = service.get_current_state()
    if character_id not in current_state.characters:
        raise HTTPException(status_code=404, detail=f"Character '{character_id}' not found.")

    player_char = current_state.characters[character_id]
    other_chars = [name for cid, char in current_state.characters.items() if cid != character_id for name in
                   [char.name]]

    return GameStatusResponse(round_number=current_state.round_number, crisis_update=current_state.crisis_update,
                              your_character=player_char, other_characters=other_chars,
                              known_intel=player_char.known_intel)


@router.get("/characters", response_model=CharacterListResponse)
async def get_all_characters(factory: CharacterFactory = Depends(get_character_factory)):
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

        profiles.append(CharacterProfile(id=raw_data.get("id"), name=raw_data.get("name"),
                                         title=ui_profile_data.get("title", "No Title Available"),
                                         description=ui_profile_data.get("description", "No Description Available"),
                                         portrait_key=ui_profile_data.get("portrait_key", "default_portrait")))

    return CharacterListResponse(characters=profiles)


@router.post("/action", status_code=202)
async def submit_action(action: Action, background_tasks: BackgroundTasks,
                        service: GameLoopService = Depends(get_game_service)):
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

        return {"message": "Action received. The round is now being processed by all delegates."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# @router.post("/guess-undergame")
# async def guess_undergame(request: EndGameRequest):
#     """
#     Endpoint for the player to submit their final guess for the undergame.
#     """
#     # In a real implementation, this would compare the guess to the actual undergame
#     # plot stored in the service and return a score.
#     actual_undergame = game_service_instance.undergame_plot
#     guess = request.undergame_guess
#
#     print(f"Player '{request.player_character_id}' guessed: {guess}")
#     print(f"Actual Undergame: {actual_undergame}")
#
#     # Simple similarity check for demonstration
#     from ares import AReS # Fictional similarity scoring library
#     score = AReS.text_similarity(guess, actual_undergame)
#
#     return {"message": "Your guess has been recorded.", "similarity_score": score}
