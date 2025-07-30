import asyncio
from functools import wraps
from pathlib import Path

import click

from philoagents.application.conversation_service.generate_response import (get_streaming_response, )
from philoagents.application.scenario_loader import ScenarioLoader
from philoagents.config import settings


def async_command(f):
    """Decorator to run an async click command."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@click.command()
@click.option('--scenario_path', type=click.Path(exists=True, path_type=Path, file_okay=False, dir_okay=True),
              default=None,
              help="The path to the scenario pack directory (e.g., './scenarios/a_clash_of_titans_216bce/').")
@click.option("--receiver-id", type=str, required=True,
              help="The ID of the character to talk to (e.g., 'hannibal_barca').", )
@click.option("--query", type=str, required=True, help="The message to send to the character.", )
@async_command
async def main(scenario_path: Path, receiver_id: str, query: str) -> None:
    """
    A command-line tool to have a direct, streaming conversation with a character
    from a specific scenario.
    """
    path_to_load = scenario_path if scenario_path else settings.SCENARIO_PATH
    if not path_to_load:
        print("Error: No scenario path provided via command line or SCENARIO_PATH in .env file.")
        return
    loader = ScenarioLoader(scenario_path=path_to_load)
    character_factory = loader.create_character_factory()
    try:
        receiver_character = character_factory.get_character(receiver_id)
    except Exception as e:
        print(f"\033[31mError: {e}\033[0m")
        print(f"Available character IDs are: {character_factory.get_available_character_ids()}")
        return

    sender_id = "cli_user"

    print(f"\033[32mInitiating conversation with '{receiver_character.name}' (ID: {receiver_id})...\033[0m")
    print(f"\033[32mYour Message: `{query}`\033[0m")
    print("\033[32m--------------------------------\033[0m")
    print(f"\033[33m{receiver_character.name}:\033[0m ", end="", flush=True)

    async for chunk in get_streaming_response(messages=query, sender_id=sender_id,
                                              receiver_character=receiver_character, ):
        print(f"\033[33m{chunk}\033[0m", end="", flush=True)

    print("\n\033[32m--------------------------------\033[0m")


if __name__ == "__main__":
    main()
