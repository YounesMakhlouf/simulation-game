from functools import lru_cache

import opik
from langchain.tools import tool

from philoagents.application.rag.retrievers import get_retriever
from philoagents.config import settings


@lru_cache(maxsize=1)
@opik.track(name="initialize_retriever", type="tool", capture_output=False)
def _retriever():
    # Built lazily on the first chat, not at import: constructing the
    # retriever loads the sentence-transformers model and requires the Atlas
    # hybrid search index, neither of which pure game-loop play needs.
    return get_retriever(
        embedding_model_id=settings.RAG_TEXT_EMBEDDING_MODEL_ID,
        k=settings.RAG_TOP_K,
        device=settings.RAG_DEVICE,
    )


@opik.track(name="hybrid_search", type="tool", ignore_arguments=["retriever"])
def _search(retriever, query: str) -> list[str]:
    return [doc.page_content for doc in retriever.invoke(query)]


@tool(response_format="content_and_artifact")
def retrieve_character_context(query: str):
    """Search and return information about a specific character.

    Use when historical facts needed for the reply are missing from your profile.
    Greetings and personal opinions do not need a search.
    """
    passages = _search(_retriever(), query)
    return "\n\n".join(passages), passages


tools = [retrieve_character_context]
