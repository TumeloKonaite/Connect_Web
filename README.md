# Connect_Web

Connect_Web is a factory sensor data explorer built for the DataProphet software engineering assessment. It lets a user sign in, choose a monitoring device and sensor, filter timestamped readings, and view numeric data as charts or text data as a table. The backend provides authenticated device and observation APIs, and the supplied synthetic dataset gives the application a realistic week of demo readings.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white) ![Docker%20Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

## Work summary

I built this application to let users securely explore factory sensor readings by device, parameter, time range, and numeric value range. I chose FastAPI with PostgreSQL for a structured API and persistent storage, and React with TypeScript for a clear interface that renders numeric readings as charts and text readings as tables. I added Docker Compose, dataset import, and tests to make the project easier to run and review; this keeps the setup repeatable while keeping the implementation focused on the assessment’s core workflow.

**Jump to:** [What you can demonstrate](#what-you-can-demonstrate) · [Features](#features) · [Tech stack](#tech-stack) · [Quick start](#quick-start) · [How to use the application](#how-to-use-the-application) · [Screenshots](#screenshots) · [Dataset](#dataset) · [API](#api-overview) · [Authentication](#authentication) · [Tests](#tests-and-validation) · [Troubleshooting](#troubleshooting) · [Design decisions](#design-decisions-and-known-limitations)

## What you can demonstrate

Sign in, select a factory device and parameter, choose a time period, apply numeric minimum and maximum filters, and inspect the matching observations. Numeric parameters are shown as time-series charts; text parameters are shown in timestamp order in a table. The API also accepts timestamped readings and JSON batches.

## Features

- Email and password login with signed bearer tokens
- Device and parameter discovery
- Time-range and numeric value filtering with chronological results
- Numeric charts and timestamped text tables
- Individual observation writes and batch dataset import
- Synthetic seven-day factory sensor dataset
- Backend API and frontend automated tests

## Tech stack

| Component | Technology | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite | Authenticated data explorer and visualizations |
| Backend | Python, FastAPI, SQLAlchemy | REST API, validation, authentication, and persistence |
| Database | PostgreSQL 16 | Users, devices, parameters, and observations |
| Local environment | Docker Compose | Build and run services with repeatable commands |
| Tests | Pytest, frontend test runner | Backend API and frontend behavior checks |

## Quick start

### Prerequisites

- Docker Engine or Docker Desktop with Docker Compose v2
- GNU Make for the primary quick start (optional if using the direct Compose commands below)
- Git

Clone the repository and create a local environment file. Set private values for `POSTGRES_PASSWORD` and `JWT_SECRET_KEY` in `.env` before running the demo:

```sh
git clone <repository-url> Connect_Web
cd Connect_Web
cp .env.example .env
# Edit .env to set private POSTGRES_PASSWORD and JWT_SECRET_KEY values.
make up
make seed-devices
make create-demo-user DEMO_USER_EMAIL=demo@example.com DEMO_USER_PASSWORD='demo-password'
```

Open <http://localhost:5173> and sign in with **demo@example.com** / **demo-password**. These predictable credentials are for local assessment review only; do not use them in a deployed environment.

### Without Make: Docker Compose

Use the following equivalent commands if GNU Make is unavailable:

```sh
docker compose up --build -d --wait
docker compose exec -T backend uv run --no-sync python -m app.scripts.device_dataset
docker compose exec -T -e DEMO_USER_EMAIL=demo@example.com -e DEMO_USER_PASSWORD=demo-password backend uv run --no-sync python -m app.scripts.create_demo_user
```

In PowerShell, copy the environment template with `Copy-Item .env.example .env` instead of `cp .env.example .env`.

**Bash (Linux/macOS):**

```sh
git clone <repository-url> Connect_Web
cd Connect_Web
cp .env.example .env
```

**PowerShell (Windows):**

```powershell
git clone <repository-url> Connect_Web
Set-Location Connect_Web
Copy-Item .env.example .env
```

Edit `.env` and replace `POSTGRES_PASSWORD` and `JWT_SECRET_KEY` with private values. To generate a signing key, use `openssl rand -hex 32` if OpenSSL is installed, or in PowerShell run:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

For the Compose alternative, start the services, wait for them to become healthy, then import the demo readings and create/reset the local demo account:

```sh
docker compose up --build -d --wait
docker compose exec -T backend uv run --no-sync python -m app.scripts.device_dataset
docker compose exec -T -e DEMO_USER_EMAIL=demo@example.com -e DEMO_USER_PASSWORD=demo-password backend uv run --no-sync python -m app.scripts.create_demo_user
```

Open <http://localhost:5173> and sign in with **demo@example.com** / **demo-password**. These predictable credentials are for local assessment review only; do not use them in a deployed environment. The API health check is at <http://localhost:8000/health>, and interactive API documentation is at <http://localhost:8000/docs>.

These setup commands are safe to repeat: Compose starts or updates the stack, the importer skips existing readings, and the demo-user command resets the local demo password to the documented value. Use this account only for local review. To choose your own credentials, replace the email and password values in the commands above.

The backend applies database migrations as it starts. Keep `.env` private and do not commit it.

## How to use the application

1. Sign in with the demo account.
2. Choose a monitoring device and one of its parameters.
3. Set the start and end date/time. The time controls use your local timezone; the API stores and returns timestamps in UTC.
4. For numeric parameters, optionally set inclusive minimum and maximum values.
5. Select **View data** to display the matching chart or text table.

## Screenshots

These screenshots show the login page, the authenticated explorer, and examples of numeric and text observations:

| Login | Authenticated explorer |
| --- | --- |
| ![Connect_Web login page](docs/screenshots/login-page.svg) | ![Authenticated Sensor Data Explorer](docs/screenshots/authenticated-application.svg) |

| Numeric observations | Text observations |
| --- | --- |
| ![Numeric time-series chart](docs/screenshots/numeric-observation-chart.svg) | ![Timestamped text observation table](docs/screenshots/text-observation-table.svg) |

## Architecture and project structure

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Sensor Data Explorer, charts, tables, and API client |
| Backend | FastAPI | Authentication, input validation, and device/observation endpoints |
| Database | PostgreSQL | Persistent users, devices, parameters, and observations |
| Compose | Docker Compose | Private service network, health checks, and persistent database volume |

```text
backend/
  app/api/       FastAPI routes, dependencies, and HTTP error handling
  app/core/      Configuration and security
  app/repository/ Database models and data access
  app/services/  Dataset and observation workflows
  app/scripts/   Dataset import and demo-user command line utilities
  data/          Timestamped demonstration dataset
  migrations/    Alembic schema migrations
  tests/         Isolated backend tests
frontend/
  src/           React application, API client, and visualizations
  tests/         Frontend automated tests
docs/screenshots/ Example numeric chart and text table
```

The root README covers the full-stack setup and demo workflow. For backend-only development, database configuration, migrations, CLI utilities, API details, and backend tests, see the [backend README](backend/README.md). Frontend-specific development notes are in [frontend/README.md](frontend/README.md).

## Dataset

`backend/data/factory_sensor_demo_7days.json` contains four synthetic monitoring devices, each with five numeric and two text parameters, and one week of timestamped observations. Timestamps are UTC. The data is for demonstration only and does not represent real factory measurements. Devices, parameters, and observations are persisted in separate tables.

The `docker compose exec backend uv run --no-sync python -m app.scripts.device_dataset` command validates and imports this JSON dataset transactionally. To validate it without writing to the database, run from `backend/`:

```sh
DEBUG=false APP_ENVIRONMENT=test uv run python -m app.scripts.device_dataset --validate-only
```

The importer also accepts another compatible JSON file with `--dataset /path/to/file.json`.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the API process responds |
| `POST` | `/api/auth/login` | Exchange email and password form data for a bearer token |
| `GET` | `/api/auth/me` | Return the authenticated account |
| `GET` | `/api/devices` | List monitoring devices |
| `GET` | `/api/devices/{device_uid}` | Get a device and its configured parameters |
| `GET` | `/api/devices/{device_uid}/observations` | Query observations by parameter, time, numeric bounds, and pagination |
| `POST` | `/api/devices/{device_uid}/observations` | Add one timestamped numeric or text observation |
| `POST` | `/api/devices/import` | Validate and import a nested JSON dataset batch |

`/health`, API documentation, and login are public. Other `/api/devices` routes and `/api/auth/me` require a valid bearer token. Observation time bounds and numeric value bounds are inclusive; date/time inputs must include a timezone.

To add one observation, provide a configured parameter, timezone-aware `observed_at`, and exactly one of `numeric_value` or `text_value`. Successful writes return `201` and the stored observation. The batch route accepts the same nested JSON structure as the supplied dataset and returns counts of created devices, parameters, and observations. The `docker compose exec backend uv run --no-sync python -m app.scripts.device_dataset` command is the simpler option for importing the bundled local dataset.

For direct login, the endpoint accepts URL-encoded form fields, with the email in `username`:

```sh
curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'username=demo@example.com' \
  --data-urlencode 'password=choose-a-local-password'
```

Use the returned `access_token` as `Authorization: Bearer <token>` on protected requests. See <http://localhost:8000/docs> for request and response schemas.

## Authentication

Passwords are stored as Argon2 hashes. Login issues a signed JWT containing the user ID and expiration. `JWT_SECRET_KEY` signs tokens, `JWT_ALGORITHM` defaults to HS256, and `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` defaults to 30. Replace the template secret in `.env` with a private value (for example, `openssl rand -hex 32`).

The frontend keeps the token in memory and clears it on logout or when an API request returns 401. Refreshing the browser page requires signing in again. The application does not include account registration or token refresh. To create or reset a local account through Compose (Bash example):

```sh
DEMO_USER_EMAIL=demo@example.com
DEMO_USER_PASSWORD='choose-a-local-password'
docker compose exec -T -e DEMO_USER_EMAIL="$DEMO_USER_EMAIL" -e DEMO_USER_PASSWORD="$DEMO_USER_PASSWORD" backend uv run --no-sync python -m app.scripts.create_demo_user
```

The command hashes the password before saving it and does not print the password or stored hash. User and sensor data persist in the named PostgreSQL volume across `docker compose down` and container restarts. To remove the database volume and permanently delete local data, run `docker compose down --volumes`.

## Tests and validation

Run the backend and frontend suites from the repository root with Docker Compose:

```sh
docker compose run --rm --build --no-deps -e DEBUG=false -v "$(pwd)/backend/tests:/app/tests:ro" -w /app backend sh -c 'uv sync --frozen && uv run --no-sync pytest /app/tests'
docker compose run --rm --no-deps frontend sh -c 'npm test'
```

Backend tests use a fresh in-memory SQLite database and cover API workflows, authentication, validation, filters, and dataset import behavior without changing the Compose database. Frontend tests cover visualizations, authenticated API requests, and loading, empty, and error states. These tests do not replace checking the app against PostgreSQL through the Compose workflow.

For local non-Docker checks, install the backend dev dependencies with `cd backend && uv sync --group dev`, then use `uv run pytest`. In `frontend/`, use `npm test`, `npm run lint`, and `npm run build`.

## Useful commands

| Command | Action |
| --- | --- |
| `docker compose up --build -d` | Build and start the stack |
| `docker compose down` | Stop the stack while preserving the database volume |
| `docker compose ps` | Show service status |
| `docker compose logs -f` | Follow logs from all services |
| `docker compose down --volumes` | Remove the volume and its data |

The optional Makefile provides shorthand targets such as `make demo` for users who have GNU Make installed.

## Troubleshooting

- **Ports are already in use:** change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`, then run `docker compose up --build -d` again.
- **Compose reports missing or invalid variables:** compare `.env` with `.env.example` and check its syntax. `docker compose config --quiet` validates the configuration; avoid sharing resolved output because it may contain secrets.
- **Frontend cannot reach the backend:** check `docker compose ps` and `docker compose logs`, then open <http://localhost:8000/health>. The Compose Vite proxy uses the service name `backend`.
- **Backend does not become healthy:** inspect `docker compose logs backend db`, confirm database credentials, and allow startup time for PostgreSQL health checks and migrations.
- **Database authentication fails after changing credentials:** PostgreSQL applies initial credentials only when the data directory is first created. Existing data retains the original password. Use the original password or intentionally reset the volume with `docker compose down --volumes`.
- **Database data appears missing:** `docker compose down` preserves the named volume. Check the active Compose project with `docker compose ps` and list volumes with `docker volume ls`.

## Design decisions and known limitations

- Pydantic validates API input before persistence, and SQLAlchemy constraints provide a second validation layer in the database.
- Database access is isolated in repository modules; service code owns dataset and observation workflows.
- Backend tests use isolated SQLite fixtures. They are safe to run against local development data but do not test PostgreSQL-specific behavior.
- Observation results are paginated, with up to 100 readings per page; the frontend does not downsample or aggregate across pages.
- The backend health route is a liveness check and does not run a database query. Compose separately checks database readiness with `pg_isready`.
- The dataset is synthetic and intended to demonstrate the assessment workflow, not to model validated industrial operating limits.
