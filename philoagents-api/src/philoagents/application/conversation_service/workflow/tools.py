from langchain.tools import tool

from philoagents.application.rag.retrievers import get_retriever
from philoagents.config import settings

retriever = get_retriever(
    embedding_model_id=settings.RAG_TEXT_EMBEDDING_MODEL_ID,
    k=settings.RAG_TOP_K,
    device=settings.RAG_DEVICE,
)


@tool
def retrieve_character_context(query: str):
    """Search and return information about a specific character.

    Always use this tool when the user asks you about a character,
    their works, ideas or historical context.
    """
    return retriever.invoke(query)


tools = [retrieve_character_context]
