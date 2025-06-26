from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.domain import Action, Character
from philoagents.domain.character_factory import CharacterFactory
from philoagents.domain.game_state import GameState


# --- Singleton Game Service Instance ---
# In a real production app, this would be managed more robustly (e.g., dependency injection framework).
# For now, we'll initialize it once when the module is loaded.

def initialize_game_service():
    """Initializes the game state and service for the application lifecycle."""
    char_factory = CharacterFactory()
    initial_characters = {char_id: char_factory.get_character(char_id) for char_id in
        char_factory.get_available_character_ids()}
    initial_crisis = "The Congress of Vienna has officially opened. The major powers of Europe gather to redraw the map after two decades of war. The air is thick with tension and opportunity. The fate of Saxony and Poland are the first items on the agenda."
    undergame = "A secret cabal of international bankers, The Argentum Order, wants to design a treaty that looks fair but contains hidden flaws and unresolved tensions that will inevitably lead to another major European conflict within 25 years."

    initial_game_state = GameState(characters=initial_characters, crisis_update=initial_crisis, )
    return GameLoopService(initial_state=initial_game_state, undergame_plot=undergame)


# Create a single instance of the game service for the app to use
game_service_instance = initialize_game_service()


def get_game_service() -> GameLoopService:
    """Dependency injection function to provide the game service to endpoints."""
    return game_service_instance


# --- API Router ---
# We use an APIRouter to keep these endpoints modular.
router = APIRouter(prefix="/game", tags=["Game Loop"], )


# --- Pydantic Models for API ---
class GameStatusResponse(BaseModel):
    round_number: int
    crisis_update: str
    your_character: Character
    other_characters: list[str]


class EndGameRequest(BaseModel):
    player_character_id: str
    undergame_guess: str


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
        your_character=player_char, other_characters=other_chars)


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
