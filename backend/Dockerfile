FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.12 /uv /uvx /bin/

WORKDIR /app

ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --group dev

COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
