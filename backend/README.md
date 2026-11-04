# Backend

FastAPI service for the machine records application. Run it independently from the React frontend when you want to work on the API. The frontend does not need to be running for API development or testing.

## Requirements

- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)
- PostgreSQL 16 (local or another reachable PostgreSQL server)

The API stores machine records in PostgreSQL. The backend process does not start PostgreSQL for you.

## Configure the database

For standalone backend startup, create `backend/.env` with the database URL and API settings. Pydantic reads `.env` from the current working directory; values from the process environment also work. The root `.env.example` is intended for Docker Compose and is not automatically loaded when running the backend from `backend/`.

```dotenv
DATABASE_URL=postgresql+psycopg://connect_web:your_local_password@localhost:5432/connect_web
APP_NAME=Connect Web API
APP_ENVIRONMENT=development
DEBUG=false
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

Create the `connect_web` PostgreSQL database and user (or use your own names and update `DATABASE_URL`). Keep local credentials out of version control. If you use the repository's Docker Compose database, start only that service from the root with `docker compose up -d db`, and use host `localhost` and the published database port if you have configured one. The default Compose setup does not publish PostgreSQL's port, so for that setup use Compose to run the backend too.

## Install and start

From the backend directory:

```sh
cd backend
uv sync --group dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The migration command creates or updates the schema before the server starts. Keep the server running in this terminal. The API is available at:

- Health: <http://localhost:8000/health>
- OpenAPI documentation: <http://localhost:8000/docs>
- Machine records: <http://localhost:8000/api/machines>

To load the bundled sample data after migrations:

```sh
uv run python -m app.seed
```

The seed command uses UDI as its idempotency key. Existing UDIs are skipped, so it is safe to run more than once.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API process is responding |
| `GET` | `/api/machines?limit=25&offset=0` | List records ordered by UDI |
| `POST` | `/api/machines` | Create a record; returns `201`, or `409` for a duplicate UDI |
| `GET` | `/api/machines/{udi}` | Get one record; returns `404` if missing |
| `PATCH` | `/api/machines/{udi}` | Partially update a record; UDI is immutable |
| `DELETE` | `/api/machines/{udi}` | Delete a record; returns `204`, or `404` if missing |
| `POST` | `/api/machines/import?filename=machines.csv` | Import raw CSV data (`text/csv`) |

Create and update requests are validated. Machine type must be `L`, `M`, or `H`; failure indicators must be booleans; and speed, torque, and tool wear must be nonnegative.

## Tests and lint

Tests use isolated SQLite databases for endpoint and seed behavior, so they do not change PostgreSQL development data. From `backend/`:

```sh
uv run --group dev pytest
uv run --group dev ruff check app tests
```

If your shell exports an unrelated non-boolean `DEBUG` value, clear it for the test command:

```sh
env -u DEBUG uv run --group dev pytest
```

## Troubleshooting

- **Connection refused:** confirm PostgreSQL is running and `DATABASE_URL` points to its reachable host, port, database, and credentials.
- **Authentication/database does not exist:** create the configured PostgreSQL user and database, then retry migrations.
- **Migration command cannot find settings:** run it from `backend/` so the local `backend/.env` file is loaded, or export `DATABASE_URL` in the shell.
- **Frontend browser requests fail:** allow the frontend origin in `CORS_ORIGINS` and make sure the frontend's `VITE_API_BASE_URL` points to this server.
- **Port 8000 is busy:** choose another Uvicorn port and update the frontend API base URL to match.

For the integrated three-service workflow, see the root [README](../README.md).
