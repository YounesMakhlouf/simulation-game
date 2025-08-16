from philoagents.domain import Character


class ScoringService:
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
            # TODO: Use a real text similarity metric in production.
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
        # Placeholder for a real text similarity library (e.g., Sentence Transformers)
        # Simple keyword matching for now
        # todo: change this
        keywords = ["monolith", "audacity", "willpower", "sanity", "stability", "curse"]
        score = sum(1 for keyword in keywords if keyword in text1.lower())
        return min(score / 3.0, 1.0)  # Normalize to 0-1 range
