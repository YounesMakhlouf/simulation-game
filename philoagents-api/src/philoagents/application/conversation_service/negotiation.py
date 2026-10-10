from opik.integrations.langchain import OpikTracer

from philoagents.application.conversation_service.workflow.chains import (
    get_negotiation_summary_chain,
)
from philoagents.config import settings
from philoagents.domain.game_state import GameState


async def summarize_negotiation(
    state: GameState, sender_id: str, receiver_id: str, message: str, response: str
) -> None:
    result = await get_negotiation_summary_chain().ainvoke(
        {
            "sender_name": state.characters[sender_id].name,
            "receiver_name": state.characters[receiver_id].name,
            "round_number": state.round_number,
            "previous_summary": state.negotiation_summaries.get(receiver_id, {}).get(
                sender_id, "No prior negotiations."
            ),
            "message": message,
            "response": response,
        },
        config={
            "callbacks": [OpikTracer(project_name=settings.COMET_PROJECT)],
            "run_name": "negotiation_summary",
            "metadata": {"game_id": state.game_id, "round_number": state.round_number},
        },
    )
    summary = result.text.strip()
    if not summary:
        raise RuntimeError(
            "Negotiation summary was empty "
            f"(finish_reason={result.response_metadata.get('finish_reason')})."
        )
    for participant, counterparty in [
        (sender_id, receiver_id),
        (receiver_id, sender_id),
    ]:
        state.negotiation_summaries.setdefault(participant, {})[counterparty] = summary
