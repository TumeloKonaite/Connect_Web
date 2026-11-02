# Connect_Web

Connect_Web is a development monorepo for a React and TypeScript web client, a FastAPI service, and PostgreSQL. Docker Compose provides the standard local environment; the root Makefile wraps common Compose operations.

## Project structure

```text
.
├── backend/                 FastAPI application, Python dependencies, tests, Dockerfile
│   ├── app/api/routes/      HTTP routes, including GET /health
│   └── tests/               Backend tests
├── frontend/                React + TypeScript + Vite application and Dockerfile
│   └── src/                  UI, API client, and health status hook
├── docker-compose.yml        Frontend, backend, database, network, and volume
├── Makefile                  Shortcuts for Docker Compose commands
├── .env.example              Safe template for local configuration
└── README.md                 Development setup and troubleshooting
```

### Services and technologies

- **Frontend:** React and TypeScript build the browser interface. Vite serves the development application on port 5173 and proxies `/api` requests to the backend service.
- **Backend:** FastAPI provides HTTP endpoints on port 8000. Its `/health` endpoint reports process health, and CORS is configured from `CORS_ORIGINS` for direct browser requests.
- **Database:** PostgreSQL 16 stores application data. The backend reaches it at `db:5432` over the private Compose network. No host port is published. The named `connect-web-postgres-data` volume keeps data when containers are removed.
- **Docker Compose:** builds the frontend and backend images, starts PostgreSQL, waits for database and API health checks before starting dependent services, and provides internal DNS names such as `backend` and `db`.
- **Make:** provides consistent commands for common Compose operations.

## Prerequisites

- Git
- Docker Engine or Docker Desktop with the `docker compose` plugin
- GNU Make
- For running services independently: Node.js 22 with npm, Python 3.12, and `uv`

Check that Docker and Compose are available:

```sh
docker --version
docker compose version
make --version
```

## Configure and start the stack

Clone the repository and enter its directory:

```sh
git clone <repository-url> Connect_Web
cd Connect_Web
```

Create a private local environment file from the committed template:

```sh
cp .env.example .env
```

Edit `.env` before use and replace `POSTGRES_PASSWORD` with a strong local development password. `.env` files are ignored by Git; do not commit credentials. Compose reads the root `.env` automatically. The template lists ports, database credentials, backend settings, CORS origins, and the frontend API base path. Defaults are also provided by Compose for most settings.

Build and start all services in the background:

```sh
make up
```

Then open:

- Frontend: <http://localhost:5173>
- Backend health endpoint: <http://localhost:8000/health>
- Backend API documentation: <http://localhost:8000/docs>

The frontend health indicator calls `/api/health`; Vite forwards that request to `backend:8000` on the Compose network and removes the `/api` prefix. For local development outside Compose, set `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local` and allow that origin in `CORS_ORIGINS`.

## Makefile commands

Run these commands from the repository root:

| Command | Purpose | Deletes database data? |
| --- | --- | --- |
| `make build` | Build or rebuild service images | No |
| `make up` | Build images and start services in the background | No |
| `make down` | Stop and remove containers and the Compose network | No; the named volume remains |
| `make restart` | Restart running containers | No |
| `make logs` | Follow logs from all services; press Ctrl+C to stop following | No |
| `make ps` | Show Compose service and container status | No |

Equivalent direct Compose commands are available if needed, for example `docker compose logs -f backend` or `docker compose exec backend sh`.

**Destructive database command:** `docker compose down -v` removes the named PostgreSQL volume and permanently deletes its stored data. There is no Makefile target for this operation. `docker volume rm connect-web-postgres-data` also deletes that volume and should only be used when intentionally resetting local data.

To stop and later restart, use `make down`, then `make up`. PostgreSQL data is preserved across this cycle.

## Independent service development

The supported integrated workflow is Compose, which starts all three services and supplies the expected internal hostnames. To run a service directly, install its dependencies and provide the same configuration yourself.

Frontend (terminal 1):

```sh
cd frontend
npm ci
cp .env.example .env.local  # optionally edit VITE_API_BASE_URL
npm run dev
```

Backend (terminal 2, from repository root):

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

When running services on the host, the Compose-only Vite proxy target `backend` is not resolvable. Use `VITE_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`, and set the backend `CORS_ORIGINS` to include `http://localhost:5173`. A PostgreSQL instance must also be available; set `DATABASE_URL` (or the individual `DB_*` values) for that instance. The current health route does not query the database.

## Tests and diagnostics

The Makefile does not define a test target. Run the available tests from the service directories:

```sh
cd backend && uv run --group dev pytest
cd frontend && npm run lint
cd frontend && npm run build
```

Useful checks and container shell access:

```sh
make ps
make logs
docker compose logs -f db
docker compose exec frontend sh
docker compose exec backend sh
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

The `psql` command uses variables from the current shell; alternatively run `docker compose exec db sh` and connect with the configured user and database.

## Troubleshooting

- **Ports are already in use:** change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`, then run `make up` again.
- **Compose reports missing or invalid variables:** check `.env` syntax and compare it with `.env.example`; quote values that contain characters interpreted by Compose. Use `docker compose config` to inspect the resolved configuration (it may display secrets, so do not publish its output).
- **Frontend shows a backend connection error:** check `make ps` and `make logs`, then try <http://localhost:8000/health>. In Compose, the Vite proxy uses the service name `backend`; from a host-run frontend, use `http://localhost:8000` as the API base URL and confirm CORS includes the frontend origin.
- **Backend does not become healthy:** inspect `docker compose logs backend db`. The backend waits for PostgreSQL's health check. Confirm the database credentials in `.env` and allow startup time.
- **Database authentication fails after changing credentials:** PostgreSQL applies initialization credentials only when its data directory is first created. Existing data retains its original database password. Use the original password or intentionally reset the volume with `docker compose down -v` (this permanently deletes local database data).
- **Database data seems missing:** `make down` preserves the named volume, but changing `COMPOSE_PROJECT_NAME` does not change its explicitly named volume. Check the active Compose project and volume with `docker compose ps` and `docker volume ls`.

## Validation status

Use `docker compose config --quiet` to validate Compose syntax, `make build` to build images, and `make up`, `make ps`, and the URLs above to validate a running stack. The frontend health indicator provides an end-to-end browser-to-backend check. Database health is checked with `pg_isready`; the current backend health route is a liveness check and does not verify a database query. A screenshot can be captured locally after startup from the frontend page and included in project documentation if needed.
