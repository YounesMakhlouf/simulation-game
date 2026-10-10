from types import SimpleNamespace
from unittest.mock import Mock

from philoagents.domain import prompts


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
