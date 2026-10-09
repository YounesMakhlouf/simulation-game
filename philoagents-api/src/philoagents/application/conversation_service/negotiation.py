from philoagents.application.conversation_service.workflow.chains import (
    get_negotiation_summary_chain,
)
from philoagents.domain.game_state import GameState


async def summarize_negotiation(
    state: GameState, sender_id: str, receiver_id: str, message: str, response: str
) -> None:
    summary = await get_negotiation_summary_chain().ainvoke(
        {
            "sender_name": state.characters[sender_id].name,
            "receiver_name": state.characters[receiver_id].name,
            "round_number": state.round_number,
            "previous_summary": state.negotiation_summaries.get(receiver_id, {}).get(
                sender_id, "No prior negotiations."
            ),
            "message": message,
            "response": response,
        }
    )
    if not summary.strip():
        raise RuntimeError("Negotiation summary was empty.")
    for participant, counterparty in [
        (sender_id, receiver_id),
        (receiver_id, sender_id),
    ]:
        state.negotiation_summaries.setdefault(participant, {})[counterparty] = (
            summary.strip()
        )
