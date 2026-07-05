import asyncio
from typing import Optional

import pytest

from philoagents.application.game_loop_service import service as service_module
from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.domain import Action, Character
from philoagents.domain.action import ActionType
from philoagents.domain.game_state import GameState
from philoagents.domain.resources import PrivateIntel, VictoryPointAward


class FakeStateRepository:
    """In-memory stand-in for GameStateRepository."""

    def __init__(self, saved: Optional[GameState] = None):
        self.saved = saved
        self.save_calls = 0
        self.clear_calls = 0

    def save(self, state: GameState) -> None:
        self.saved = state.model_copy(deep=True)
        self.save_calls += 1

    def load(self) -> Optional[GameState]:
        return self.saved

    def clear(self) -> None:
        self.saved = None
        self.clear_calls += 1


def make_character(character_id: str, victory_points: int = 0) -> Character:
    return Character(
        id=character_id,
        name=character_id.replace("_", " ").title(),
        perspective="Test perspective",
        style="Test style",
        goals="Test goals",
        resources={"Gold": 10},
        victory_points=victory_points,
    )


def make_state(round_number: int = 1) -> GameState:
    return GameState(
        round_number=round_number,
        crisis_update="Initial crisis",
        characters={
            "hannibal": make_character("hannibal"),
            "scipio": make_character("scipio"),
        },
    )


def make_service(
    repository: Optional[FakeStateRepository] = None,
    state: Optional[GameState] = None,
) -> GameLoopService:
    return GameLoopService(
        initial_state=state or make_state(),
        undergame_plot="The secret undergame plot.",
        factory=None,
        undergame_plot_display="The displayed undergame plot.",
        state_repository=repository,
    )


def make_action(character_id: str, resource_cost: Optional[dict] = None) -> Action:
    return Action(
        character_id=character_id,
        reasoning="Test reasoning",
        action_type=ActionType.MILITARY,
        action_details="March on the enemy camp.",
        resource_cost=resource_cost or {},
    )


# --- submit_player_action guards ---


def test_submit_action_stores_action():
    service = make_service()
    service.submit_player_action(make_action("hannibal"))
    assert "hannibal" in service.submitted_actions


def test_submit_action_rejects_unknown_character():
    service = make_service()
    with pytest.raises(ValueError, match="does not exist"):
        service.submit_player_action(make_action("caesar"))


def test_submit_action_rejects_duplicate():
    service = make_service()
    service.submit_player_action(make_action("hannibal"))
    with pytest.raises(ValueError, match="already submitted"):
        service.submit_player_action(make_action("hannibal"))


def test_submit_action_rejected_while_round_is_processing():
    service = make_service()
    service.is_processing_round = True
    with pytest.raises(ValueError, match="being resolved"):
        service.submit_player_action(make_action("hannibal"))


def test_submit_action_rejected_when_game_over():
    service = make_service()
    service.is_game_over = True
    with pytest.raises(ValueError, match="game is over"):
        service.submit_player_action(make_action("hannibal"))


def test_submit_action_rejects_negative_resource_cost():
    service = make_service()
    with pytest.raises(ValueError, match="cannot be negative"):
        service.submit_player_action(make_action("hannibal", {"Gold": -5}))


def test_submit_action_rejects_unknown_resource():
    service = make_service()
    with pytest.raises(ValueError, match="no resource named 'Elephants'"):
        service.submit_player_action(make_action("hannibal", {"Elephants": 2}))


def test_submit_action_rejects_unaffordable_cost():
    service = make_service()  # characters start with Gold: 10
    with pytest.raises(ValueError, match="Insufficient 'Gold'"):
        service.submit_player_action(make_action("hannibal", {"Gold": 11}))


def test_submit_action_accepts_affordable_cost():
    service = make_service()
    service.submit_player_action(make_action("hannibal", {"Gold": 10}))
    assert "hannibal" in service.submitted_actions


# --- advance_round orchestration ---


def stub_round(service: GameLoopService, judge_result=None, judge_error=None):
    """Stubs the AI delegate and judge turns so no LLM is involved."""

    async def fake_ai_turns():
        return [
            make_action(char_id)
            for char_id in service.game_state.characters
            if char_id not in service.submitted_actions
        ]

    async def fake_judge_turn(all_actions, characters):
        if judge_error is not None:
            raise judge_error
        return judge_result

    service._run_ai_delegate_turns = fake_ai_turns
    service._run_judge_turn = fake_judge_turn


def test_advance_round_happy_path():
    repository = FakeStateRepository()
    service = make_service(repository)

    # The judge returns brand-new Character objects (not the originals), as it
    # would after a LangGraph state round-trip. Intel and VPs must still land
    # on the state the game keeps.
    new_characters = {
        "hannibal": make_character("hannibal"),
        "scipio": make_character("scipio"),
    }
    stub_round(
        service,
        judge_result=(
            "A new crisis unfolds.",
            new_characters,
            [PrivateIntel(recipient_id="hannibal", report="Scipio is bluffing.")],
            [
                VictoryPointAward(
                    character_id="scipio", points_awarded=3, reason="Bold move"
                )
            ],
        ),
    )

    service.submit_player_action(make_action("hannibal"))
    new_state = asyncio.run(service.advance_round())

    assert new_state.round_number == 2
    assert new_state.crisis_update == "A new crisis unfolds."
    assert service.submitted_actions == {}
    assert not service.is_processing_round
    assert not service.is_game_over
    # Intel and VPs were applied to the judge's NEW character objects.
    assert (
        "Scipio is bluffing." in service.game_state.characters["hannibal"].known_intel
    )
    assert service.game_state.characters["scipio"].victory_points == 3
    # The new state was persisted.
    assert repository.save_calls == 1
    assert repository.saved.round_number == 2


def test_advance_round_sets_game_over_after_max_rounds():
    service = make_service(state=make_state(round_number=4))
    stub_round(
        service,
        judge_result=("Final crisis.", service.game_state.characters, None, None),
    )
    asyncio.run(service.advance_round())
    assert service.is_game_over


def test_advance_round_rejects_concurrent_runs():
    async def scenario():
        service = make_service()
        release = asyncio.Event()

        async def blocking_ai_turns():
            await release.wait()
            return []

        async def fake_judge_turn(all_actions, characters):
            return ("New crisis.", service.game_state.characters, None, None)

        service._run_ai_delegate_turns = blocking_ai_turns
        service._run_judge_turn = fake_judge_turn

        first_round = asyncio.create_task(service.advance_round())
        while not service.is_processing_round:
            await asyncio.sleep(0)

        with pytest.raises(RuntimeError, match="already being processed"):
            await service.advance_round()

        release.set()
        await first_round
        assert not service.is_processing_round

    asyncio.run(scenario())


def test_advance_round_failure_clears_flag_and_keeps_actions():
    repository = FakeStateRepository()
    service = make_service(repository)
    stub_round(service, judge_error=RuntimeError("judge LLM unavailable"))

    service.submit_player_action(make_action("hannibal"))
    with pytest.raises(RuntimeError, match="judge LLM unavailable"):
        asyncio.run(service.advance_round())

    assert not service.is_processing_round
    assert "hannibal" in service.submitted_actions  # retriable
    assert service.game_state.round_number == 1  # state untouched
    assert repository.save_calls == 0


def test_advance_round_succeeds_when_retried_after_failure():
    repository = FakeStateRepository()
    service = make_service(repository)
    service.submit_player_action(make_action("hannibal"))

    stub_round(service, judge_error=RuntimeError("judge LLM unavailable"))
    with pytest.raises(RuntimeError):
        asyncio.run(service.advance_round())

    stub_round(
        service,
        judge_result=("Recovered crisis.", service.game_state.characters, None, None),
    )
    new_state = asyncio.run(service.advance_round())

    assert new_state.round_number == 2
    assert new_state.crisis_update == "Recovered crisis."
    assert repository.save_calls == 1


# --- deterministic cost settlement ---


def stub_echo_judge(service: GameLoopService):
    """Stubs the judge to return exactly the settled characters it was given."""

    async def fake_ai_turns():
        return []

    async def fake_judge_turn(all_actions, characters):
        return ("A new crisis unfolds.", characters, None, None)

    service._run_ai_delegate_turns = fake_ai_turns
    service._run_judge_turn = fake_judge_turn


def test_advance_round_deducts_declared_costs_deterministically():
    service = make_service()
    stub_echo_judge(service)

    service.submit_player_action(make_action("hannibal", {"Gold": 4}))
    new_state = asyncio.run(service.advance_round())

    assert new_state.characters["hannibal"].resources["Gold"] == 6
    assert new_state.characters["scipio"].resources["Gold"] == 10


def test_advance_round_clamps_hallucinated_ai_costs():
    # AI actions bypass submit_player_action, so their costs are sanitized
    # (unknown resources dropped, overspends clamped) rather than rejected.
    service = make_service()
    stub_echo_judge(service)
    service.submitted_actions["hannibal"] = make_action(
        "hannibal", {"Gold": 99, "Elephants": 3}
    )
    service.submitted_actions["scipio"] = make_action("scipio", {"Gold": -2})

    new_state = asyncio.run(service.advance_round())

    assert new_state.characters["hannibal"].resources["Gold"] == 0
    assert "Elephants" not in new_state.characters["hannibal"].resources
    assert new_state.characters["scipio"].resources["Gold"] == 10


def test_failed_round_does_not_charge_costs():
    service = make_service()
    stub_round(service, judge_error=RuntimeError("judge LLM unavailable"))
    service.submit_player_action(make_action("hannibal", {"Gold": 4}))

    with pytest.raises(RuntimeError):
        asyncio.run(service.advance_round())

    # The live state was never charged, so the retry will not double-deduct.
    assert service.game_state.characters["hannibal"].resources["Gold"] == 10


# --- victory point clamping ---


def test_vp_awards_are_clamped_to_the_per_round_cap():
    service = make_service()
    cap = service_module.settings.MAX_VP_AWARD_PER_ROUND
    service._apply_victory_points(
        [
            VictoryPointAward(
                character_id="hannibal", points_awarded=999, reason="Judge went wild"
            ),
            VictoryPointAward(
                character_id="scipio", points_awarded=-10, reason="Negative award"
            ),
            VictoryPointAward(
                character_id="caesar", points_awarded=5, reason="Unknown character"
            ),
        ]
    )

    assert service.game_state.characters["hannibal"].victory_points == cap
    assert service.game_state.characters["scipio"].victory_points == 0


# --- AI delegate timeout and fallback ---


class FakeGraphBuilder:
    def __init__(self, graph):
        self._graph = graph

    def compile(self):
        return self._graph


class FailingGraph:
    def get_graph(self, xray=True):
        return None

    async def ainvoke(self, input, config):
        raise RuntimeError("model exploded")


class HangingGraph:
    def get_graph(self, xray=True):
        return None

    async def ainvoke(self, input, config):
        await asyncio.sleep(30)


def _patch_graph(monkeypatch, graph):
    monkeypatch.setattr(
        service_module, "create_action_graph", lambda: FakeGraphBuilder(graph)
    )
    monkeypatch.setattr(service_module, "OpikTracer", lambda graph=None: object())


def test_ai_delegate_error_falls_back_to_safe_action(monkeypatch):
    service = make_service()
    _patch_graph(monkeypatch, FailingGraph())

    actions = asyncio.run(service._run_ai_delegate_turns())

    assert {a.character_id for a in actions} == {"hannibal", "scipio"}
    assert all(a.action_type == ActionType.DIPLOMACY for a in actions)
    assert all("holds position" in a.action_details for a in actions)


def test_ai_delegate_timeout_falls_back_to_safe_action(monkeypatch):
    service = make_service()
    _patch_graph(monkeypatch, HangingGraph())
    monkeypatch.setattr(service_module.settings, "AI_ACTION_TIMEOUT_SECONDS", 0.05)

    actions = asyncio.run(service._run_ai_delegate_turns())

    assert {a.character_id for a in actions} == {"hannibal", "scipio"}
    assert all("holds position" in a.action_details for a in actions)


# --- persistence: resume and reset ---


def test_try_resume_restores_saved_state():
    saved = make_state(round_number=3)
    service = make_service(FakeStateRepository(saved=saved))

    assert service.try_resume() is True
    assert service.game_state.round_number == 3
    assert service.is_game_over is False


def test_try_resume_marks_finished_game_as_over():
    saved = make_state(round_number=5)  # past max_rounds=4
    service = make_service(FakeStateRepository(saved=saved))

    assert service.try_resume() is True
    assert service.is_game_over is True


def test_try_resume_without_saved_game():
    assert make_service(FakeStateRepository()).try_resume() is False


def test_try_resume_without_repository():
    assert make_service().try_resume() is False


def test_reset_restores_initial_state_and_clears_persistence():
    repository = FakeStateRepository()
    service = make_service(repository)
    service.game_state.round_number = 3
    service.game_state.crisis_update = "Late-game crisis"
    service.submitted_actions["hannibal"] = make_action("hannibal")
    service.is_game_over = True

    state = service.reset()

    assert state.round_number == 1
    assert state.crisis_update == "Initial crisis"
    assert service.submitted_actions == {}
    assert service.is_game_over is False
    assert repository.clear_calls == 1


def test_reset_rejected_while_round_is_processing():
    service = make_service()
    service.is_processing_round = True
    with pytest.raises(RuntimeError, match="Cannot reset"):
        service.reset()


# --- finalize_scores single-shot behavior ---


def _stub_scoring(service, monkeypatch, ai_guess="a theory"):
    """No LLM (AI guesses) and no embedding model (similarity) in unit tests."""

    async def fake_guesses(player_character_id):
        return {
            char_id: ai_guess
            for char_id in service.game_state.characters
            if char_id != player_character_id
        }

    service._generate_ai_guesses = fake_guesses
    monkeypatch.setattr(
        "philoagents.application.scoring_service._default_embed_fn",
        lambda: lambda text: [1.0, 0.0],
    )


def test_finalize_scores_rejected_before_game_over():
    service = make_service()
    with pytest.raises(ValueError, match="not over"):
        asyncio.run(service.finalize_scores("hannibal", "my guess"))


def test_finalize_scores_rejects_unknown_character():
    service = make_service()
    service.is_game_over = True
    with pytest.raises(ValueError, match="not found"):
        asyncio.run(service.finalize_scores("caesar", "my guess"))


def test_finalize_scores_locks_guesses_and_persists(monkeypatch):
    repository = FakeStateRepository()
    service = make_service(repository)
    service.is_game_over = True
    _stub_scoring(service, monkeypatch)

    scores, actual = asyncio.run(service.finalize_scores("hannibal", "my theory"))

    assert service.game_state.player_undergame_guess == "my theory"
    assert service.game_state.ai_undergame_guesses == {"scipio": "a theory"}
    assert repository.save_calls == 1
    assert actual == "The displayed undergame plot."
    assert set(scores.keys()) == {"hannibal", "scipio"}


def test_finalize_scores_is_single_shot_ignoring_later_guesses(monkeypatch):
    repository = FakeStateRepository()
    service = make_service(repository)
    service.is_game_over = True
    _stub_scoring(service, monkeypatch)

    first, _ = asyncio.run(service.finalize_scores("hannibal", "first guess"))
    # A second call must not change the locked-in guesses, re-generate the AI
    # guesses, nor re-persist.
    service._generate_ai_guesses = None  # would crash if called again
    second, _ = asyncio.run(
        service.finalize_scores("hannibal", "a much better second guess")
    )

    assert service.game_state.player_undergame_guess == "first guess"
    assert repository.save_calls == 1
    assert first == second
