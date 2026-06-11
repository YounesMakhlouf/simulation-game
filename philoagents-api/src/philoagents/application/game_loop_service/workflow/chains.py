from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from philoagents.config import settings
from philoagents.domain import Action
from philoagents.domain.prompts import DELEGATE_ACTION_PROMPT, JUDGE_RESOLUTION_PROMPT
from philoagents.domain.resources import JudgeOutput


def get_chat_model(
    temperature: float = 0.7,
    model_name: str = settings.GROQ_LLM_MODEL,
    max_tokens: int | None = None,
) -> ChatGroq:
    """
    A generic factory function to initialize and return a ChatGroq model instance.
    """
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def get_character_action_chain():
    """
    Creates the LCEL chain for the Delegate Action Agent.

    This chain takes the game state as input and forces the LLM to output a
    structured JSON object conforming to the `Action` Pydantic model.

    Returns:
        A compiled LCEL chain ready for invocation.
    """
    # Use a low temperature for more deterministic, strategic, and less "creative" actions.
    model = get_chat_model(temperature=0.3, model_name=settings.GROQ_LLM_MODEL_JUDGE)
    structured_llm = model.with_structured_output(Action)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", DELEGATE_ACTION_PROMPT.prompt),
        ],
        template_format="jinja2",
    )

    return (prompt | structured_llm).with_retry(stop_after_attempt=3)


def get_judge_resolution_chain():
    """
    Creates the LCEL chain for the AI Judge Agent.

    This chain takes the list of player actions and the secret undergame plot,
    and forces the LLM to output a structured JSON object conforming to the
    `JudgeOutput` Pydantic model.

    Returns:
        A compiled LCEL chain ready for invocation.
    """
    # Use a higher temperature to encourage more creative and narrative-rich crisis updates.
    # The judge's structured output (narrative + full state for every character) is
    # large; without an explicit max_tokens it gets truncated mid-JSON and Groq
    # rejects the tool call.
    model = get_chat_model(
        temperature=0.7,
        model_name=settings.GROQ_LLM_MODEL_JUDGE,
        max_tokens=settings.GROQ_JUDGE_MAX_TOKENS,
    )

    structured_llm = model.with_structured_output(JudgeOutput)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", JUDGE_RESOLUTION_PROMPT.prompt),
        ],
        template_format="jinja2",
    )

    return (prompt | structured_llm).with_retry(stop_after_attempt=3)
