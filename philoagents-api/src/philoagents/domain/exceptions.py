class CharacterNotFound(Exception):
    """
    Exception raised when a character with the specified ID cannot be found
    in the factory. This is a lookup error, not a data validation error.
    """

    def __init__(self, character_id: str):
        self.message = f"Character with ID '{character_id}' could not be found in the loaded scenario data."
        super().__init__(self.message)
