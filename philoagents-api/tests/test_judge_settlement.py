from philoagents.application.game_loop_service.workflow.nodes import (
    _apply_resource_updates,
)
from philoagents.domain import Character
from philoagents.domain.resources import UpdatedCharacterState


def make_character(character_id: str) -> Character:
    return Character(
        id=character_id,
        name=character_id.replace("_", " ").title(),
        perspective="Test perspective",
        style="Test style",
        goals="Test goals",
        resources={"Gold": 10, "Spies": 3},
        statuses={"Morale": "High"},
    )


def make_update(character_id: str, resources: dict, statuses: dict | None = None):
    return UpdatedCharacterState(
        character_id=character_id,
        resources=resources,
        statuses=statuses or {},
    )


def test_applies_proposed_resources_and_statuses():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_resource_updates(
        characters,
        [make_update("hannibal", {"Gold": 7, "Spies": 4}, {"Morale": "Low"})],
    )
    assert result["hannibal"].resources == {"Gold": 7, "Spies": 4}
    assert result["hannibal"].statuses == {"Morale": "Low"}


def test_negative_resources_are_clamped_to_zero():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_resource_updates(
        characters, [make_update("hannibal", {"Gold": -50, "Spies": 3})]
    )
    assert result["hannibal"].resources["Gold"] == 0


def test_unknown_character_updates_are_ignored():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_resource_updates(
        characters, [make_update("caesar", {"Gold": 1000})]
    )
    assert set(result) == {"hannibal"}
    assert result["hannibal"].resources["Gold"] == 10


def test_omitted_character_keeps_previous_state():
    characters = {
        "hannibal": make_character("hannibal"),
        "scipio": make_character("scipio"),
    }
    result = _apply_resource_updates(
        characters, [make_update("hannibal", {"Gold": 5, "Spies": 3})]
    )
    assert result["scipio"].resources == {"Gold": 10, "Spies": 3}
    assert result["scipio"].statuses == {"Morale": "High"}


def test_omitted_resource_keys_are_preserved():
    # The Judge cannot silently delete an asset by leaving it out.
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_resource_updates(characters, [make_update("hannibal", {"Gold": 5})])
    assert result["hannibal"].resources == {"Gold": 5, "Spies": 3}


def test_judge_can_introduce_new_resources():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_resource_updates(
        characters, [make_update("hannibal", {"Gold": 10, "Spies": 3, "Ships": 2})]
    )
    assert result["hannibal"].resources["Ships"] == 2
