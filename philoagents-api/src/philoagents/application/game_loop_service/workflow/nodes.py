import json
from typing import Dict, List

from loguru import logger

from philoagents.application.game_loop_service.workflow.chains import (
    get_character_action_chain,
    get_judge_resolution_chain,
)
from philoagents.application.game_loop_service.workflow.state import (
    ActionState,
    ResolutionState,
)
from philoagents.domain import Character
from philoagents.domain.resources import UpdatedCharacterState

# --- Delegate Action Agent Node ---


async def action_decision_node(state: ActionState) -> Dict:
    """
    The primary node for the Delegate Action Agent.

    It invokes the action chain to decide on a character's single, official
    action for the current round based on the game state.
    """
    character = state["character"]
    logger.info(f"Agent '{character.name}' is deliberating their official action...")

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
        logger.warning(
            f"Agent hallucinated character ID! Expected '{character.id}', got "
            f"'{action_response.character_id}'. Overwriting for consistency."
        )
        action_response.character_id = character.id

    logger.info(
        f"Action decided by {character.name}: {action_response.action_type} - "
        f"{action_response.action_details}"
    )

    return {"action": action_response}


# --- Judge Resolution Agent Node ---


def _apply_resource_updates(
    characters: Dict[str, Character],
    updated_character_state: List[UpdatedCharacterState],
) -> Dict[str, Character]:
    """
    Applies the Judge's proposed character states while enforcing server-side
    invariants, since the LLM's arithmetic cannot be trusted:

    - Updates for unknown character IDs are ignored.
    - Proposed resource values are clamped to be non-negative.
    - Resources the Judge omitted keep their previous value (the Judge cannot
      silently delete an asset), and characters it omitted entirely keep
      their previous state.
    """
    updated_ids = set()
    for update in updated_character_state:
        character = characters.get(update.character_id)
        if character is None:
            logger.warning(
                f"Judge referenced unknown character '{update.character_id}'; "
                f"ignoring the update."
            )
            continue
        updated_ids.add(update.character_id)

        new_resources = dict(character.resources)
        for resource, value in update.resources.items():
            if value < 0:
                logger.warning(
                    f"Judge set '{resource}' to {value} for "
                    f"'{update.character_id}'; clamping to 0."
                )
                value = 0
            new_resources[resource] = value

        omitted = set(character.resources) - set(update.resources)
        if omitted:
            logger.warning(
                f"Judge omitted resources {sorted(omitted)} for "
                f"'{update.character_id}'; keeping their previous values."
            )

        character.resources = new_resources
        character.statuses = update.statuses

    missing = set(characters) - updated_ids
    if missing:
        logger.warning(
            f"Judge omitted state updates for {sorted(missing)}; "
            f"keeping their previous state."
        )
    return characters


async def resolution_node(state: ResolutionState) -> Dict:
    """
    The primary node for the AI Judge Agent.

    It takes all submitted actions for the round, invokes the resolution chain
    to process them according to the secret Undergame, and produces the new
    world state.
    """
    logger.info("AI Judge is resolving the round...")

    resolution_chain = get_judge_resolution_chain()

    # Convert the list of Action Pydantic models to a JSON string for the prompt.
    actions_json_str = json.dumps([a.model_dump() for a in state["actions"]], indent=2)
    current_game_state_json = state.get("current_game_state_json", "{}")

    judge_output = await resolution_chain.ainvoke(
        {
            "undergame_plot": state["undergame_plot"],
            "actions_json": actions_json_str,
            "current_game_state_json": current_game_state_json,
        }
    )

    logger.info("Judge has made a decision. Crafting new crisis update...")

    original_characters = state["characters"]
    updated_characters = _apply_resource_updates(
        original_characters, judge_output.updated_character_states
    )
    return {
        "crisis_update": judge_output.crisis_update,
        "updated_characters": updated_characters,
        "private_intel_reports": judge_output.private_intel_reports,
        "victory_point_awards": judge_output.victory_point_awards,
    }
