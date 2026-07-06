from philoagents.application.game_loop_service.workflow.nodes import (
    _apply_judge_output,
)
from philoagents.domain import Character
from philoagents.domain.resources import CharacterStatusUpdate, ResourceChange


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


def change(character_id: str, resource: str, delta: int) -> ResourceChange:
    return ResourceChange(
        character_id=character_id,
        resource=resource,
        change=delta,
        reason="test reason",
    )


def statuses(character_id: str, values: dict) -> CharacterStatusUpdate:
    return CharacterStatusUpdate(character_id=character_id, statuses=values)


def test_applies_gains_and_losses_as_deltas():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(
        characters,
        [change("hannibal", "Gold", -3), change("hannibal", "Spies", 1)],
        [],
    )
    assert result["hannibal"].resources == {"Gold": 7, "Spies": 4}


def test_overdraw_is_clamped_to_zero():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(characters, [change("hannibal", "Gold", -50)], [])
    assert result["hannibal"].resources["Gold"] == 0


def test_unknown_character_changes_are_ignored():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(characters, [change("caesar", "Gold", 1000)], [])
    assert set(result) == {"hannibal"}
    assert result["hannibal"].resources["Gold"] == 10


def test_gain_can_introduce_a_new_resource():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(characters, [change("hannibal", "Ships", 2)], [])
    assert result["hannibal"].resources["Ships"] == 2


def test_loss_of_unknown_resource_is_ignored():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(characters, [change("hannibal", "Ships", -2)], [])
    assert "Ships" not in result["hannibal"].resources


def test_no_changes_leaves_characters_untouched():
    characters = {
        "hannibal": make_character("hannibal"),
        "scipio": make_character("scipio"),
    }
    result = _apply_judge_output(characters, [], [])
    assert result["scipio"].resources == {"Gold": 10, "Spies": 3}
    assert result["scipio"].statuses == {"Morale": "High"}


def test_status_update_replaces_only_listed_characters():
    characters = {
        "hannibal": make_character("hannibal"),
        "scipio": make_character("scipio"),
    }
    result = _apply_judge_output(
        characters, [], [statuses("hannibal", {"Morale": "Low", "Besieged": True})]
    )
    assert result["hannibal"].statuses == {"Morale": "Low", "Besieged": True}
    assert result["scipio"].statuses == {"Morale": "High"}


def test_status_update_for_unknown_character_is_ignored():
    characters = {"hannibal": make_character("hannibal")}
    result = _apply_judge_output(characters, [], [statuses("caesar", {"X": 1})])
    assert result["hannibal"].statuses == {"Morale": "High"}
