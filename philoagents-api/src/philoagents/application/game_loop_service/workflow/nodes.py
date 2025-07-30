import json
from typing import Dict, List

from philoagents.application.game_loop_service.workflow.chains import (
    get_character_action_chain,
    get_judge_resolution_chain,
)
from philoagents.application.game_loop_service.workflow.state import (
    ActionState,
    ResolutionState,
)
from philoagents.domain import Character
from philoagents.domain.resources import UpdatedResource

# --- Delegate Action Agent Node ---


async def action_decision_node(state: ActionState) -> Dict:
    """
    The primary node for the Delegate Action Agent.

    It invokes the action chain to decide on a character's single, official
    action for the current round based on the game state.
    """
    character = state["character"]
    print(f"--- Agent '{character.name}' is deliberating their official action... ---")

    action_chain = get_character_action_chain()

    action_response = await action_chain.ainvoke(
        {
            "character_name": character.name,
            "character_perspective": character.perspective,
            "character_style": character.style,
            "character_goals": character.goals,
            "character_resources": character.resources,
            "other_players_dossier": state["other_players_dossier"],
            "crisis_update": state["crisis_update"],
        }
    )
    if action_response.character_id.lower() != character.id.lower():
        print(
            f"WARNING: Agent hallucinated character ID! Expected '{character.id}', got '{action_response.character_id}'. Overwriting for consistency."
        )
        action_response.character_id = character.id

    print(
        f"Action Decided by {character.name}: {action_response.action_type} - {action_response.action_details}"
    )

    return {"action": action_response}


# --- Judge Resolution Agent Node ---


def _apply_resource_updates(
    characters: Dict[str, Character], updated_resources: List[UpdatedResource]
) -> Dict[str, Character]:
    """
    A helper function to safely update character resources based on the Judge's output.
    """
    for update in updated_resources:
        if update.character_id in characters:
            characters[update.character_id].resources = update.resources
    return characters


async def resolution_node(state: ResolutionState) -> Dict:
    """
    The primary node for the AI Judge Agent.

    It takes all submitted actions for the round, invokes the resolution chain
    to process them according to the secret Undergame, and produces the new
    world state.
    """
    print("--- AI Judge is resolving the round... ---")

    resolution_chain = get_judge_resolution_chain()

    # Convert the list of Action Pydantic models to a JSON string for the prompt.
    actions_json_str = json.dumps([a.model_dump() for a in state["actions"]], indent=2)

    judge_output = await resolution_chain.ainvoke(
        {"undergame_plot": state["undergame_plot"], "actions_json": actions_json_str}
    )

    print("Judge has made a decision. Crafting new crisis update...")

    original_characters = state["characters"]
    updated_characters = _apply_resource_updates(
        original_characters, judge_output.updated_resources
    )
    return {
        "crisis_update": judge_output.crisis_update,
        "updated_characters": updated_characters,
        "private_intel_reports": judge_output.private_intel_reports,
    }
