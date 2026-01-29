FROM python:3.12-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set the working directory.
WORKDIR /app

# Increase timeout for large package downloads (NVIDIA CUDA libraries)
ENV UV_HTTP_TIMEOUT=300

# Install the application dependencies.
COPY uv.lock pyproject.toml README.md ./
RUN uv sync --frozen --no-cache

# Copy the application into the container.
COPY src/philoagents philoagents/
COPY tools tools/

CMD ["/app/.venv/bin/fastapi", "run", "philoagents/infrastructure/api.py", "--port", "8000", "--host", "0.0.0.0"]
