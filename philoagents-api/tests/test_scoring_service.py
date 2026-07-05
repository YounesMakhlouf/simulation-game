from philoagents.application.scoring_service import ScoringService, _cosine
from tests.test_game_loop_service import make_character

# Fake embedder: maps known texts to fixed vectors so similarity is exact.
VECTORS = {
    "the actual plot": [1.0, 0.0],
    "a perfect guess": [1.0, 0.0],
    "an unrelated guess": [0.0, 1.0],
}


def make_scoring_service() -> ScoringService:
    return ScoringService(embed_fn=lambda text: VECTORS[text])


def test_cosine():
    assert _cosine([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert _cosine([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert _cosine([], []) == 0.0


def test_perfect_guess_gets_full_undergame_score():
    service = make_scoring_service()
    scores = service.calculate_final_scores(
        characters=[make_character("hannibal", victory_points=10)],
        undergame_guesses={"hannibal": "a perfect guess"},
        actual_undergame="the actual plot",
    )
    assert scores["hannibal"]["undergame_score"] == 20
    assert scores["hannibal"]["total_score"] == 100


def test_unrelated_guess_gets_zero_undergame_score():
    service = make_scoring_service()
    scores = service.calculate_final_scores(
        characters=[make_character("hannibal", victory_points=10)],
        undergame_guesses={"hannibal": "an unrelated guess"},
        actual_undergame="the actual plot",
    )
    assert scores["hannibal"]["undergame_score"] == 0


def test_empty_guess_scores_zero_without_calling_embedder():
    service = ScoringService(embed_fn=None)  # would load the real model if called
    assert service._calculate_similarity("", "the actual plot") == 0.0
    assert service._calculate_similarity("   ", "the actual plot") == 0.0


def test_faction_score_is_relative_to_best_player():
    service = make_scoring_service()
    scores = service.calculate_final_scores(
        characters=[
            make_character("hannibal", victory_points=10),
            make_character("scipio", victory_points=5),
        ],
        undergame_guesses={},
        actual_undergame="the actual plot",
    )
    assert scores["hannibal"]["faction_score"] == 80
    assert scores["scipio"]["faction_score"] == 40
