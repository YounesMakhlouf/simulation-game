from typing import Generator

from bs4 import BeautifulSoup
from langchain_community.document_loaders import WebBaseLoader, WikipediaLoader
from langchain_core.documents import Document
from tqdm import tqdm

from philoagents.domain.character import Character, CharacterExtract
from philoagents.domain.character_factory import CharacterFactory


def get_extraction_generator(characters: list[CharacterExtract], ) -> Generator[
    tuple[Character, list[Document]], None, None]:
    """Extract documents for a list of characters, yielding one at a time.

    Args:
        characters: A list of CharacterExtract objects containing character information.

    Yields:
        tuple[Character, list[Document]]: A tuple containing the character object and a list of
            documents extracted for that character.
    """

    progress_bar = tqdm(characters, desc="Extracting docs", unit="character",
                        bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}] {postfix}",
                        ncols=100, position=0, leave=True, )

    characters_factory = CharacterFactory()
    for character_extract in progress_bar:
        character = characters_factory.get_character(character_extract.id)
        progress_bar.set_postfix_str(f"Character: {character.name}")

        character_docs = extract(character, character_extract.urls)

        yield character, character_docs


def extract(character: Character, extract_urls: list[str]) -> list[Document]:
    """Extract documents for a single character from all sources and deduplicate them.

    Args:
        character: Character object containing character information.
        extract_urls: List of URLs to extract content from.

    Returns:
        list[Document]: List of deduplicated documents extracted for the character.
    """

    docs = []

    docs.extend(extract_wikipedia(character))
    docs.extend(extract_encyclopedia_britannica(character, extract_urls))

    return docs


def extract_wikipedia(character: Character) -> list[Document]:
    """Extract documents for a single character from Wikipedia.

    Args:
        character: Character object containing character information.

    Returns:
        list[Document]: List of documents extracted from Wikipedia for the character.
    """

    loader = WikipediaLoader(query=character.name, lang="en", load_max_docs=1, doc_content_chars_max=1000000, )
    docs = loader.load()

    for doc in docs:
        doc.metadata["character_id"] = character.id
        doc.metadata["character_name"] = character.name

    return docs


def extract_encyclopedia_britannica(character: Character, urls: list[str]) -> list[Document]:
    """
    Extracts documents for a character from provided URLs, assuming they are
    from Encyclopedia Britannica or similarly structured sites.

    Args:
        character: The Character object.
        urls: A list of specific URLs to scrape.

    Returns:
        A list of documents extracted from the URLs.
    """

    def clean_britannica_html(soup: BeautifulSoup) -> str:
        """
        A specific cleaner for Encyclopedia Britannica article pages.
        It removes common non-content elements like ToC, asides, and footers.
        """
        # List of CSS selectors for elements to remove from the soup
        excluded_selectors = ["aside#toc",  # Table of Contents
            ".md-quick-fact",  # "Quick Facts" box
            ".md-header-tools",  # Cite, Share, Print buttons
            "figcaption",  # Image captions
            ".md-related-links",  # "Related Links" sidebar
            ".md-grid-group",  # "More From Britannica" sections
            "footer",  # Page footer
        ]

        # Find and remove elements matching the selectors
        for selector in excluded_selectors:
            for element in soup.select(selector):
                element.decompose()

        # Extract the main article content after cleaning
        main_article = soup.find("article")
        if not main_article:
            # Fallback if the <article> tag is not found
            return ""

        # Extract remaining paragraphs and headers from the cleaned article
        content = []
        for element in main_article.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
            content.append(element.get_text())

        return "\n\n".join(content)

    if not urls:
        return []

        # Use WebBaseLoader to scrape the raw HTML into BeautifulSoup objects
    loader = WebBaseLoader(show_progress=False)
    soups = loader.scrape_all(urls)

    documents = []
    # Process each scraped page
    for url, soup in zip(urls, soups):
        # Clean the HTML to get the main article text
        text = clean_britannica_html(soup)

        # Skip documents where no content could be extracted
        if not text:
            continue

        # Create the metadata dictionary
        metadata = {"source": url, "character_id": character.id, "character_name": character.name,
            "source_type": "Encyclopedia"}

        # Attempt to add the page title to the metadata
        if title := soup.find("title"):
            metadata["title"] = title.get_text().strip(" \n")

        documents.append(Document(page_content=text, metadata=metadata))

    return documents


def extract_stanford_encyclopedia_of_philosophy(character: Character, urls: list[str]) -> list[Document]:
    """Extract documents for a single character from Stanford Encyclopedia of Philosophy.

    Args:
        character: Character object containing character information.
        urls: List of URLs to extract content from.

    Returns:
        list[Document]: List of documents extracted from Stanford Encyclopedia for the character.
    """

    def extract_paragraphs_and_headers(soup) -> str:
        # List of class/id names specific to the Stanford Encyclopedia of Philosophy that we want to exclude.
        excluded_sections = ["bibliography", "academic-tools", "other-internet-resources", "related-entries",
                             "acknowledgments", "article-copyright", "article-banner", "footer", ]

        # Find and remove elements within excluded sections
        for section_name in excluded_sections:
            for section in soup.find_all(id=section_name):
                section.decompose()

            for section in soup.find_all(class_=section_name):
                section.decompose()

            for section in soup.find_all(lambda tag: tag.has_attr("id") and section_name in tag["id"].lower()):
                section.decompose()

            for section in soup.find_all(
                    lambda tag: tag.has_attr("class") and any(section_name in cls.lower() for cls in tag["class"])):
                section.decompose()

        # Extract remaining paragraphs and headers
        content = []
        for element in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
            content.append(element.get_text())

        return "\n\n".join(content)

    if len(urls) == 0:
        return []

    loader = WebBaseLoader(show_progress=False)
    soups = loader.scrape_all(urls)

    documents = []
    for url, soup in zip(urls, soups):
        text = extract_paragraphs_and_headers(soup)
        metadata = {"source": url, "character_id": character.id, "character_name": character.name, }

        if title := soup.find("title"):
            metadata["title"] = title.get_text().strip(" \n")

        documents.append(Document(page_content=text, metadata=metadata))

    return documents


if __name__ == "__main__":
    aristotle = CharacterFactory().get_character("metternich")
    docs = extract_stanford_encyclopedia_of_philosophy(aristotle,
                                                       ["https://www.britannica.com/biography/Klemens-von-Metternich/",
                                                        "https://www.britannica.com/biography/Klemens-von-Metternich/", ], )
    print(docs)
