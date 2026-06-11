import os

# Settings is instantiated at import time and requires GROQ_API_KEY; the unit
# tests never call the real API, so a placeholder is enough.
os.environ.setdefault("GROQ_API_KEY", "test-key-not-real")
