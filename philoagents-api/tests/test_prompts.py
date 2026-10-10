import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

from philoagents.application.game_loop_service.workflow import chains
from philoagents.domain import prompts
from philoagents.domain.action import Action
from philoagents.domain.resources import JudgeOutput


def test_prompt_uses_client_api(monkeypatch):
    client = Mock()
    version = SimpleNamespace(prompt="Hello {{name}}", commit="exact-version")
    client.create_prompt.return_value = version
    monkeypatch.setattr(prompts.opik, "Opik", Mock(return_value=client))
    attach_trace = Mock()
    attach_span = Mock()
    monkeypatch.setattr(
        prompts.opik.opik_context, "attach_prompt_to_current_trace", attach_trace
    )
    monkeypatch.setattr(
        prompts.opik.opik_context, "attach_prompt_to_current_span", attach_span
    )
    prompt = prompts.Prompt("greeting", "Hello {{name}}")
    client.create_prompt.assert_called_once_with(
        name="greeting", prompt="Hello {{name}}"
    )
    assert prompt.prompt == str(prompt) == repr(prompt) == "Hello {{name}}"
    assert all(call.args == (version,) for call in attach_trace.call_args_list)
    assert all(call.args == (version,) for call in attach_span.call_args_list)
    assert attach_trace.call_count == attach_span.call_count == 3


def test_prompt_keeps_local_template_when_opik_fails(monkeypatch):
    client = Mock()
    client.create_prompt.side_effect = RuntimeError("Opik unavailable")
    monkeypatch.setattr(prompts.opik, "Opik", Mock(return_value=client))
    attach_trace = Mock()
    monkeypatch.setattr(
        prompts.opik.opik_context, "attach_prompt_to_current_trace", attach_trace
    )
    prompt = prompts.Prompt("greeting", "Hello {{name}}")
    assert prompt.prompt == str(prompt) == "Hello {{name}}"
    attach_trace.assert_not_called()


def test_judge_prompt_renders_configured_vp_cap(monkeypatch):
    monkeypatch.setattr(chains.settings, "MAX_VP_AWARD_PER_ROUND", 12)
    model = Mock()
    model.with_structured_output.return_value = RunnableLambda(lambda value: value)
    monkeypatch.setattr(chains, "get_chat_model", lambda **kwargs: model)

    rendered = (
        chains.get_judge_resolution_chain()
        .invoke(
            {
                "undergame_plot": "Secret rule",
                "actions_json": "[]",
                "current_game_state_json": "{}",
            }
        )
        .to_messages()[0]
        .content
    )

    assert "Cap the award at 12 VP." in rendered
    assert "{{max_vp_award_per_round}}" not in rendered


@pytest.mark.parametrize(
    "prompt",
    [
        prompts.DELEGATE_ACTION_PROMPT,
        prompts.JUDGE_RESOLUTION_PROMPT,
        prompts.ACTION_EVALUATION_DATASET_GENERATION_PROMPT,
    ],
    ids=["action", "judge", "action_dataset"],
)
def test_prompt_example_is_valid_json_and_matches_schema(prompt):
    text = prompt.prompt
    template = ChatPromptTemplate.from_messages(
        [("system", text)],
        template_format="jinja2",
    )
    rendered = (
        template.invoke({name: "Example" for name in template.input_variables})
        .to_messages()[0]
        .content
    )
    example_text = text.split("{% raw %}", 1)[1].split("{% endraw %}", 1)[0].strip()
    assert example_text in rendered
    example = json.loads(example_text)

    if prompt is prompts.JUDGE_RESOLUTION_PROMPT:
        JudgeOutput.model_validate(example)
        return
    if prompt is prompts.ACTION_EVALUATION_DATASET_GENERATION_PROMPT:
        assert isinstance(example["situation"], str)
        example = example["expected_action"]
    Action.model_validate(example)
    assert all(
        type(cost) is int and cost >= 0 for cost in example["resource_cost"].values()
    )
