import pytest
from langchain_core.documents import Document

from philoagents.application.data.deduplicate_documents import (
    deduplicate_documents,
    find_duplicates,
)


@pytest.mark.parametrize(
    "texts",
    [
        ["Rome", "Carthage", "Roman senate", "Carthaginian council", "", "!!!", "???"],
        ["alpha beta gamma", "alpha beta delta"],
        ["alpha beta gamma delta", "alpha beta gamma epsilon"],
    ],
)
def test_distinct_short_documents_and_final_words_are_preserved(texts):
    documents = [Document(page_content=text) for text in texts]

    assert find_duplicates(documents) == []
    assert deduplicate_documents(documents) == documents


@pytest.mark.parametrize(
    "text", ["", "!!!", "Rome", "Roman senate", "Rome controls trade"]
)
def test_identical_documents_keep_the_first_copy_and_report_original_indices(text):
    documents = [
        Document(page_content=text, metadata={"copy": 1}),
        Document(page_content="Carthage commands its fleet"),
        Document(page_content=text, metadata={"copy": 2}),
        Document(page_content="Athens debates a treaty"),
        Document(page_content=text, metadata={"copy": 3}),
    ]

    assert set(find_duplicates(documents)) == {(0, 2, 1.0), (0, 4, 1.0), (2, 4, 1.0)}
    assert deduplicate_documents(documents) == [
        documents[0],
        documents[1],
        documents[3],
    ]


def test_short_documents_require_exact_content_equality():
    documents = [
        Document(page_content=text)
        for text in ["Rome", "rome", "Rome!", "Rome?", "Roman senate", "Roman  senate"]
    ]

    assert find_duplicates(documents) == []
    assert deduplicate_documents(documents) == documents
