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
from philoagents.domain.resources import CharacterStatusUpdate, ResourceChange

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
            "character_id": character.id,
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


def _apply_judge_output(
    characters: Dict[str, Character],
    resource_changes: List[ResourceChange],
    status_updates: List[CharacterStatusUpdate],
) -> Dict[str, Character]:
    """
    Applies the Judge's outcome deltas to the settled character states.

    The Judge only ever proposes changes (gains/losses with reasons); all
    arithmetic happens here, so LLM math can never corrupt the economy:

    - Changes for unknown character IDs are ignored.
    - A loss is clamped so a balance never goes below zero.
    - A gain of a resource the character doesn't have yet creates it (the
      Judge may legitimately grant new assets); a loss of an unknown
      resource is ignored.
    - Statuses are narrative, not arithmetic: each listed character's status
      dictionary is replaced wholesale; unlisted characters keep theirs.
    """
    for change in resource_changes:
        character = characters.get(change.character_id)
        if character is None:
            logger.warning(
                f"Judge referenced unknown character '{change.character_id}'; "
                f"ignoring the change."
            )
            continue

        current = character.resources.get(change.resource)
        if current is None:
            if change.change <= 0:
                logger.warning(
                    f"Judge deducted unknown resource '{change.resource}' from "
                    f"'{change.character_id}'; ignoring."
                )
                continue
            current = 0

        new_value = max(0, current + change.change)
        if current + change.change < 0:
            logger.warning(
                f"Judge deducted {-change.change} '{change.resource}' from "
                f"'{change.character_id}' with only {current} available; "
                f"clamping to 0."
            )
        character.resources[change.resource] = new_value
        logger.info(
            f"{change.character_id}: {change.resource} "
            f"{change.change:+d} -> {new_value} ({change.reason})"
        )

    for update in status_updates:
        character = characters.get(update.character_id)
        if character is None:
            logger.warning(
                f"Judge referenced unknown character '{update.character_id}'; "
                f"ignoring the status update."
            )
            continue
        character.statuses = update.statuses

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
    updated_characters = _apply_judge_output(
        original_characters,
        judge_output.resource_changes,
        judge_output.status_updates,
    )
    return {
        "crisis_update": judge_output.crisis_update,
        "updated_characters": updated_characters,
        "private_intel_reports": judge_output.private_intel_reports,
        "victory_point_awards": judge_output.victory_point_awards,
    }
