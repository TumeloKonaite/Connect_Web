# Backend

FastAPI service for timestamped demo device data. Run it independently from the React frontend when you want to work on the API. The frontend does not need to be running for API development or testing.

## Requirements

- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)
- PostgreSQL 16 (local or another reachable PostgreSQL server)

The API stores devices, parameters, observations, and users in PostgreSQL. The backend process does not start PostgreSQL for you.

## Configure the database

For standalone backend startup, create `backend/.env` with the database URL and API settings. Pydantic reads `.env` from the current working directory; values from the process environment also work. The root `.env.example` is intended for Docker Compose and is not automatically loaded when running the backend from `backend/`.

```dotenv
DATABASE_URL=postgresql+psycopg://connect_web:your_local_password@localhost:5432/connect_web
APP_NAME=Connect Web API
APP_ENVIRONMENT=development
DEBUG=false
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
JWT_SECRET_KEY=replace-with-a-random-secret-before-use
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Generate a local signing secret with `openssl rand -hex 32`. Never commit a real secret. Login accepts OAuth2 form data at `POST /api/auth/login`, using the email in `username`; it returns a bearer token valid for 30 minutes by default. Send it as `Authorization: Bearer <access_token>` to protected routes. `/health`, `/docs`, `/openapi.json`, and login are public; `/api/auth/me` and device, parameter, and observation routes require authentication. Missing, invalid, expired, or inactive-user tokens receive the same `401` response. To test in Swagger, create a demo user using the Compose command in the root README, log in, then use **Authorize** and enter the returned access token. Protected requests through Docker Compose use the same header against `http://localhost:8000`.

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

Migrations `20261106_0005` and `20261106_0006` remove the legacy source-row table and observations linked to its inaccurate CSV schedule. Back up legacy rows or observations first if you need to retain them; manually entered observations and accounts remain stored.

To import the supplied timestamped device dataset:

```sh
uv run python -m app.scripts.device_dataset
```

The command validates and imports `backend/data/factory_sensor_demo_7days.json`, including its existing device definitions, values, and timestamps. It prints counts of created devices, parameters, and observations. Use `uv run python -m app.scripts.device_dataset --validate-only` to check the JSON without importing it, or provide `--dataset /path/to/file.json` for another compatible dataset. Repeated observations are skipped by parameter and timestamp.


## Create a demo user

With the Compose stack running and migrations applied, create or reset a demo account through Compose (Bash example):

```sh
DEMO_USER_EMAIL=demo@example.com
DEMO_USER_PASSWORD=choose-a-local-password
docker compose exec -T -e DEMO_USER_EMAIL="$DEMO_USER_EMAIL" -e DEMO_USER_PASSWORD="$DEMO_USER_PASSWORD" backend uv run --no-sync python -m app.scripts.create_demo_user
```

The command runs inside the backend container, hashes the password with Argon2 before saving, and creates the account or resets its password if it already exists. It prints the email and status only; it never prints the supplied password or stored hash. Keep demo credentials private and use them only for local development.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API process is responding |
| `GET` | `/api/devices` | List devices ordered by device UID |
| `GET` | `/api/devices/{device_uid}` | Get a device and its parameters |
| `GET` | `/api/devices/{device_uid}/observations` | Query chronological observations with time, value, and pagination filters |
| `POST` | `/api/devices/{device_uid}/observations` | Add a timestamped numeric or text observation |
| `POST` | `/api/devices/import` | Validate and import a nested devices/parameters/observations JSON batch |
| `POST` | `/api/auth/login` | Log in with email and password form fields (`username` contains email) |
| `GET` | `/api/auth/me` | Get details for the active authenticated user |

Observation creation requires a configured parameter, a timezone-aware `observed_at`, and exactly one of `numeric_value` or `text_value`. The supplied value must match the parameter's configured type. Successful writes return `201`.

Batch import uses the same nested JSON shape as `factory_sensor_demo_7days.json`. Send it as an authenticated `application/json` request; the operation is transactional and idempotent.

## Tests and lint

Tests use isolated SQLite databases for API behavior and JSON dataset validation/import, so they do not change PostgreSQL development data. From `backend/`:

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
