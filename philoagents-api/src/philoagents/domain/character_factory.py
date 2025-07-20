# in philoagents/domain/character_factory.py

from typing import Dict, List

# Import the domain models and the new, simpler exception
from philoagents.domain import Character
from philoagents.domain.exceptions import CharacterNotFound


class CharacterFactory:
    """
    An object-oriented factory for creating and managing Character instances.

    This factory is initialized with character data loaded from a scenario file.
    It provides a clean interface to retrieve character objects by their ID.
    """

    def __init__(self, character_data: List[Dict]):
        """
        Initializes the factory with a list of character data dictionaries.

        Args:
            character_data: A list of dictionaries, where each dictionary
                            conforms to the structure of the Character model. This
                            data is typically loaded from a characters.json file.
        
        Raises:
            pydantic.ValidationError: If any character dictionary in the list
                                      is missing required fields.
        """
        self._raw_data: Dict[str, Dict] = {char_dict['id']: char_dict for char_dict in character_data}

        # We process the list into a dictionary for fast, O(1) lookups by character ID.
        # Pydantic automatically validates the data during this conversion.
        self._characters: Dict[str, Character] = {char_dict['id']: Character(**char_dict) for char_dict in
                                                  character_data}
        self.available_ids: List[str] = list(self._characters.keys())
        print(f"CharacterFactory initialized with {len(self.available_ids)} characters.")

    def get_character(self, character_id: str) -> Character:
        """
        Retrieves a specific Character instance by its ID.

        Args:
            character_id: The unique identifier for the character.

        Returns:
            A deep copy of the instantiated Character object.

        Raises:
            CharacterNotFound: If the character_id is not valid.
        """
        id_lower = character_id.lower()

        if id_lower not in self._characters:
            raise CharacterNotFound(id_lower)

        return self._characters[id_lower].model_copy(deep=True)

    def get_available_character_ids(self) -> List[str]:
        """Returns a list of all available character IDs loaded into the factory."""
        return self.available_ids

    def get_all_characters(self) -> List[Character]:
        """Returns a list of all character objects."""
        return [char.model_copy(deep=True) for char in self._characters.values()]

    def get_character_raw_data(self, character_id: str) -> Dict:
        """
        Retrieves the original, raw dictionary for a character by ID.
        This is useful for accessing extra data not present in the core domain model,
        such as the 'ui_profile'.
        """
        id_lower = character_id.lower()
        if id_lower not in self._raw_data:
            raise CharacterNotFound(id_lower)
        return self._raw_data[id_lower]
