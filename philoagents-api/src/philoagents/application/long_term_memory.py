from typing import Dict, List

from langchain_core.documents import Document
from loguru import logger

from philoagents.application.rag.retrievers import Retriever, get_retriever
from philoagents.application.rag.splitters import Splitter, get_splitter
from philoagents.config import settings
from philoagents.domain.character_factory import CharacterFactory
from philoagents.infrastructure.mongo import MongoClientWrapper, MongoIndex
from .data import deduplicate_documents, RagExtractor


class LongTermMemoryCreator:
    """
    Orchestrates the entire RAG ingestion pipeline: extracting, chunking,
    embedding, and storing character knowledge in MongoDB.
    """

    def __init__(self, retriever: Retriever, splitter: Splitter, extractor: RagExtractor):
        self.retriever = retriever
        self.splitter = splitter
        self.extractor = extractor

    @classmethod
    def build_from_settings(cls, character_factory: CharacterFactory) -> "LongTermMemoryCreator":
        retriever = get_retriever(embedding_model_id=settings.RAG_TEXT_EMBEDDING_MODEL_ID, k=settings.RAG_TOP_K,
            device=settings.RAG_DEVICE, )
        splitter = get_splitter(chunk_size=settings.RAG_CHUNK_SIZE)

        extractor = RagExtractor(character_factory=character_factory)

        return cls(retriever, splitter, extractor)

    def __call__(self, rag_sources: List[Dict]) -> None:
        """
        Executes the full RAG ingestion pipeline for a given set of sources.

        Args:
            rag_sources: A list of dictionaries loaded from the scenario's rag_sources.json.
        """
        if not rag_sources:
            logger.warning("No RAG sources provided. Exiting.")
            return

        logger.info("Clearing existing long-term memory collection...")
        with MongoClientWrapper(model=Document, collection_name=settings.MONGO_LONG_TERM_MEMORY_COLLECTION) as client:
            client.clear_collection()

        logger.info("Starting document extraction from web sources...")
        extraction_generator = self.extractor.get_extraction_generator(rag_sources)

        for _, docs in extraction_generator:
            if not docs:
                continue

            chunked_docs = self.splitter.split_documents(docs)
            chunked_docs = deduplicate_documents(chunked_docs, threshold=0.7)

            logger.info(f"Adding {len(chunked_docs)} chunks to vector store...")
            self.retriever.vectorstore.add_documents(chunked_docs)

        logger.info("Document ingestion complete. Creating database index...")
        self.__create_index()
        logger.info("Index created successfully. Long-term memory is ready.")

    def __create_index(self) -> None:
        """Creates the hybrid search index in MongoDB."""
        with MongoClientWrapper(model=Document, collection_name=settings.MONGO_LONG_TERM_MEMORY_COLLECTION) as client:
            index = MongoIndex(retriever=self.retriever, mongodb_client=client, )
            index.create(is_hybrid=True, embedding_dim=settings.RAG_TEXT_EMBEDDING_MODEL_DIM)

class LongTermMemoryRetriever:
    def __init__(self, retriever: Retriever) -> None:
        self.retriever = retriever

    @classmethod
    def build_from_settings(cls) -> "LongTermMemoryRetriever":
        retriever = get_retriever(embedding_model_id=settings.RAG_TEXT_EMBEDDING_MODEL_ID, k=settings.RAG_TOP_K,
            device=settings.RAG_DEVICE, )
        return cls(retriever)

    def __call__(self, query: str) -> list[Document]:
        return self.retriever.invoke(query)
