import math
from functools import lru_cache
from typing import Callable, Optional

from philoagents.config import settings
from philoagents.domain import Character

EmbedFn = Callable[[str], list[float]]


@lru_cache(maxsize=1)
def _default_embed_fn() -> EmbedFn:
    # Reuse the RAG embedding model; loaded lazily so importing this module
    # (and unit-testing it with a fake embedder) never touches the model.
    from philoagents.application.rag.embeddings import get_embedding_model

    model = get_embedding_model(
        settings.RAG_TEXT_EMBEDDING_MODEL_ID, settings.RAG_DEVICE
    )
    return model.embed_query


class ScoringService:
    def __init__(self, embed_fn: Optional[EmbedFn] = None):
        self._embed_fn = embed_fn

    def calculate_final_scores(
        self,
        characters: list[Character],
        undergame_guesses: dict,
        actual_undergame: str,
    ):
        final_scores = {}
        for char in characters:
            # 1. Playing Score (80%)
            max_vp = (
                max(c.victory_points for c in characters)
                if any(c.victory_points for c in characters)
                else 1
            )
            faction_score = (char.victory_points / max_vp) * 80

            # 2. Undergame Deduction Score (20%)
            guess = undergame_guesses.get(char.id, "")
            similarity = self._calculate_similarity(guess, actual_undergame)
            undergame_score = similarity * 20

            final_scores[char.id] = {
                "name": char.name,
                "faction_score": round(faction_score),
                "undergame_score": round(undergame_score),
                "total_score": round(faction_score + undergame_score),
            }
        return final_scores

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Semantic similarity of the guess to the actual plot, in [0, 1]."""
        if not text1.strip() or not text2.strip():
            return 0.0
        embed = self._embed_fn or _default_embed_fn()
        cos = _cosine(embed(text1), embed(text2))
        # ponytail: linear rescale of the cosine; unrelated sentence pairs sit
        # around 0.2 and near-paraphrases above 0.8 for MiniLM. Calibrate with
        # a graded rubric if scores feel unfair in play.
        return max(0.0, min(1.0, (cos - 0.2) / 0.6))


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(x * x for x in b))
    return dot / norm if norm else 0.0
