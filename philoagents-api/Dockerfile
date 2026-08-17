FROM python:3.12-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set the working directory.
WORKDIR /app

# Increase timeout for large package downloads (NVIDIA CUDA libraries)
ENV UV_HTTP_TIMEOUT=300

# Install third-party dependencies first so this layer only rebuilds when the
# lock file changes, then copy the source and install the project itself.
COPY uv.lock pyproject.toml README.md ./
RUN uv sync --frozen --no-cache --no-install-project

COPY src src/
COPY tools tools/
RUN uv sync --frozen --no-cache

CMD ["/app/.venv/bin/fastapi", "run", "src/philoagents/infrastructure/api.py", "--port", "8000", "--host", "0.0.0.0"]
