class PhilosopherNameNotFound(Exception):
    """Exception raised when a philosopher's name is not found."""

    def __init__(self, philosopher_id: str):
        self.message = f"Philosopher name for {philosopher_id} not found."
        super().__init__(self.message)


class PhilosopherPerspectiveNotFound(Exception):
    """Exception raised when a philosopher's perspective is not found."""

    def __init__(self, philosopher_id: str):
        self.message = f"Philosopher perspective for {philosopher_id} not found."
        super().__init__(self.message)


class PhilosopherStyleNotFound(Exception):
    """Exception raised when a philosopher's style is not found."""

    def __init__(self, philosopher_id: str):
        self.message = f"Philosopher style for {philosopher_id} not found."
        super().__init__(self.message)


class PhilosopherContextNotFound(Exception):
    """Exception raised when a philosopher's context is not found."""

    def __init__(self, philosopher_id: str):
        self.message = f"Philosopher context for {philosopher_id} not found."
        super().__init__(self.message)


class CharacterDataNotFound(Exception):
    """Base exception for when a character's configuration data is missing."""

    def __init__(self, character_id: str, data_type: str):
        self.message = f"Character data of type '{data_type}' not found for ID '{character_id}'."
        super().__init__(self.message)


class CharacterNameNotFound(CharacterDataNotFound):
    """Exception raised when a character's name is not found."""

    def __init__(self, character_id: str):
        super().__init__(character_id, "name")


class CharacterPerspectiveNotFound(CharacterDataNotFound):
    """Exception raised when a character's perspective is not found."""

    def __init__(self, character_id: str):
        super().__init__(character_id, "perspective")


class CharacterStyleNotFound(CharacterDataNotFound):
    """Exception raised when a character's style is not found."""

    def __init__(self, character_id: str):
        super().__init__(character_id, "style")


class CharacterGoalsNotFound(CharacterDataNotFound):
    """Exception raised when a character's goals are not found."""

    def __init__(self, character_id: str):
        super().__init__(character_id, "goals")


class CharacterResourcesNotFound(CharacterDataNotFound):
    """Exception raised when a character's starting resources are not found."""

    def __init__(self, character_id: str):
        super().__init__(character_id, "resources")
