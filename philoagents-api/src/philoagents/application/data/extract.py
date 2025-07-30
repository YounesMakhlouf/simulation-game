from typing import Dict, Generator, List

from bs4 import BeautifulSoup
from langchain_community.document_loaders import WebBaseLoader, WikipediaLoader
from langchain_core.documents import Document
from tqdm import tqdm

from philoagents.config import settings
from philoagents.domain.character import Character
from philoagents.domain.character_factory import CharacterFactory


class RagExtractor:
    """
    A class responsible for extracting raw text data from various web sources
    to build the knowledge base for a given scenario.
    """

    def __init__(self, character_factory: CharacterFactory):
        self.character_factory = character_factory

    def get_extraction_generator(
        self, rag_sources: List[Dict]
    ) -> Generator[tuple[Character, List[Document]], None, None]:
        """
        Extracts documents for all characters defined in the RAG sources, yielding one at a time.

        Args:
            rag_sources: A list of dictionaries loaded from the scenario's rag_sources.json.

        Yields:
            tuple[Character, list[Document]]: A tuple containing the character object and a list of
                documents extracted for that character.
        """
        progress_bar = tqdm(
            rag_sources,
            desc="Extracting RAG docs",
            unit="character",
            bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
        )

        for source_info in progress_bar:
            character_id = source_info["character_id"]
            character = self.character_factory.get_character(character_id)
            progress_bar.set_postfix_str(f"Character: {character.name}")

            character_docs = self._extract_for_character(character, source_info)
            yield character, character_docs

    def _extract_for_character(
        self, character: Character, source_info: Dict
    ) -> List[Document]:
        """
        Orchestrates the extraction from all configured sources for a single character.
        """
        docs = []

        if "wikipedia_query" in source_info:
            docs.extend(
                self._extract_wikipedia(character, source_info["wikipedia_query"])
            )

        if "britannica_urls" in source_info:
            docs.extend(
                self._extract_britannica(character, source_info["britannica_urls"])
            )

        return docs

    @staticmethod
    def _extract_wikipedia(character: Character, query: str) -> List[Document]:
        """Extracts a document for a single character from Wikipedia."""
        loader = WikipediaLoader(
            query=query,
            lang="en",
            load_max_docs=1,
            doc_content_chars_max=2_000_000,
        )
        docs = loader.load()
        for doc in docs:
            doc.metadata["character_id"] = character.id
            doc.metadata["character_name"] = character.name
            doc.metadata["source_type"] = "Wikipedia"
        return docs

    @staticmethod
    def _extract_britannica(character: Character, urls: List[str]) -> List[Document]:
        """Extracts documents from Encyclopedia Britannica URLs."""
        if not urls:
            return []

        def clean_britannica_html(soup: BeautifulSoup) -> str:
            excluded_selectors = [
                "aside#toc",
                ".md-quick-fact",
                ".md-header-tools",
                "figcaption",
                ".md-related-links",
                ".md-grid-group",
                "footer",
            ]
            for selector in excluded_selectors:
                for element in soup.select(selector):
                    element.decompose()
            main_article = soup.find("article")
            if not main_article:
                return ""
            return "\n\n".join(
                element.get_text()
                for element in main_article.find_all(["p", "h1", "h2", "h3", "h4"])
            )

        loader = WebBaseLoader(show_progress=False)
        soups = loader.scrape_all(urls)
        documents = []
        for url, soup in zip(urls, soups):
            text = clean_britannica_html(soup)
            if not text:
                continue
            metadata = {
                "source": url,
                "character_id": character.id,
                "character_name": character.name,
                "source_type": "Encyclopedia",
            }
            if title := soup.find("title"):
                metadata["title"] = title.get_text().strip(" \n")
            documents.append(Document(page_content=text, metadata=metadata))
        return documents


# --- Standalone Test Block ---
if __name__ == "__main__":
    import json

    # 1. Define the scenario to test
    SCENARIO_PATH = settings.SCENARIO_PATH

    # 2. Load the scenario data just like the main application would
    print("--- Loading Scenario Data ---")
    with open(SCENARIO_PATH / "characters.json", "r") as f:
        character_data = json.load(f)
    with open(SCENARIO_PATH / "rag_sources.json", "r") as f:
        rag_sources_data = json.load(f)

    # 3. Initialize the factory and extractor with the loaded data
    char_factory = CharacterFactory(character_data=character_data)
    extractor = RagExtractor(character_factory=char_factory)

    # 4. Run the extraction generator and print results
    print("\n--- Starting RAG Extraction ---")
    extraction_generator = extractor.get_extraction_generator(
        rag_sources=rag_sources_data
    )

    for character, docs in extraction_generator:
        print(f"\n--- Results for: {character.name} ---")
        print(f"Total documents found: {len(docs)}")
        for i, doc in enumerate(docs):
            source = doc.metadata.get("source", "Wikipedia")
            print(f"  - Doc {i + 1} from '{source}' ({len(doc.page_content)} chars)")
