from types import SimpleNamespace
from unittest.mock import Mock

from philoagents.domain import prompts


def test_prompt_uses_client_api(monkeypatch):
    client = Mock()
    client.create_prompt.return_value = SimpleNamespace(prompt="Hello {{name}}")
    monkeypatch.setattr(prompts.opik, "Opik", Mock(return_value=client))
    prompt = prompts.Prompt("greeting", "Hello {{name}}")
    client.create_prompt.assert_called_once_with(
        name="greeting", prompt="Hello {{name}}"
    )
    assert prompt.prompt == str(prompt) == repr(prompt) == "Hello {{name}}"


def test_prompt_keeps_local_template_when_opik_fails(monkeypatch):
    client = Mock()
    client.create_prompt.side_effect = RuntimeError("Opik unavailable")
    monkeypatch.setattr(prompts.opik, "Opik", Mock(return_value=client))
    prompt = prompts.Prompt("greeting", "Hello {{name}}")
    assert prompt.prompt == str(prompt) == "Hello {{name}}"
