# Connect_Web

Connect_Web is a development monorepo for a React and TypeScript web client, a FastAPI service, and PostgreSQL. Docker Compose provides the standard local environment; the root Makefile wraps common Compose operations.

## Project structure

```text
.
├── backend/                 FastAPI application, Python dependencies, tests, Dockerfile
│   ├── app/api/routes/      HTTP routes, including GET /health
│   └── tests/               Backend tests
├── frontend/                React + TypeScript + Vite application, API client, and Dockerfile
│   └── src/                  Machine records page, forms, table, and API status
├── docker-compose.yml        Frontend, backend, database, network, and volume
├── Makefile                  Shortcuts for Docker Compose commands
├── .env.example              Safe template for local configuration
└── README.md                 Development setup and troubleshooting
```

### Services and technologies

- **Frontend:** React and TypeScript provide a machine records workspace for listing, creating, editing, and deleting machine data. Vite serves the development application on port 5173 and proxies `/api` requests to the backend service.
- **Backend:** FastAPI provides HTTP endpoints on port 8000. Its `/health` endpoint reports process health, and CORS is configured from `CORS_ORIGINS` for direct browser requests.
- **Machine records API:** `POST`, `GET`, `PATCH`, and `DELETE` operations are available under `/api/machines`. The collection GET supports `limit` (default 100, maximum 500) and `offset` (default 0). Record identifiers use the dataset's positive `udi` value.
- **Device API:** read-only endpoints list devices, return device parameters, and retrieve chronologically ordered observations filtered by parameter and optional timezone-aware start/end timestamps. Numeric parameters also support inclusive `min_value` and `max_value` filters. Observation results support `limit` and `offset` pagination.
- **Database:** PostgreSQL 16 stores application data. The backend reaches it at `db:5432` over the private Compose network. No host port is published. The named `connect-web-postgres-data` volume keeps data when containers are removed.
- **Docker Compose:** builds the frontend and backend images, starts PostgreSQL, waits for database and API health checks before starting dependent services, and provides internal DNS names such as `backend` and `db`.
- **Make:** provides consistent commands for common Compose operations.

## Seed sample machine records

The repository includes a representative 14-column dataset at `backend/data/machine_records.csv`. The backend image contains this file and the standalone importer at `backend/app/seed.py` maps each CSV column directly to its matching `MachineRecord` field.

Start PostgreSQL and the application services, then ensure migrations are current (the backend startup runs `alembic upgrade head` automatically):

```sh
make up
make seed
make seed-devices
```

`make seed` runs the importer inside the running backend container and prints processed, inserted, duplicate, invalid, and failed counts. Verify records in the API at <http://localhost:8000/api/machines> or in Swagger at <http://localhost:8000/docs>.

The import uses `udi` as its idempotency key. A row with a UDI already in the database is reported as a duplicate and left unchanged. Missing values, malformed numbers or booleans, unsupported types, and values that violate model constraints are reported as invalid and skipped. Each valid row commits independently; a database error rolls back only that row and later rows continue. A missing required CSV header stops the import with an actionable error. Re-running `make seed` is safe and does not overwrite development records.

The prerequisites are Docker with Compose v2, a running database service, and the current Alembic migrations. `make up` starts the database and applies migrations through the backend entry command; if services were stopped, start them before running the seed target.

## Simulated device time series

The device dataset workflow preserves `backend/data/machine_records.csv` and generates `backend/data/device_observations.json` from it. Run `make seed-devices` with the stack running to generate and import it. To generate JSON without importing, run `python -m app.device_dataset --generate-only` from `backend/` (or pass `--csv` and `--json` paths). The JSON is validated before it is written or imported; import is transactional and repeat runs skip existing `(parameter, source_udi)` observations.

Four demonstration devices are assigned deterministically by `(UDI - 1) modulo 4`. Each device has five numeric parameters (air temperature in K, process temperature in K, rotational speed in rpm, torque in Nm, and tool wear in minutes) and two text parameters (product type and machine failure status). Machine failure booleans become `normal` or `failure`. Observations retain their source UDI. The source CSV measurements and categorical values are unchanged in the original machine records.

Timestamps are simulated in UTC: UDI 1 starts at 2025-01-01 00:00 UTC, and each subsequent UDI advances the generated schedule by five minutes. Records assigned to any one device therefore have a strictly increasing schedule. These are demonstration timestamps, not collection times, and the device assignment does not represent real physical monitoring hardware. The generated JSON metadata states these assumptions explicitly. `devices`, `parameters`, and `observations` are stored separately; an observation reaches its device through its parameter and may point back to `machine_records.udi`.

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

### Machine records API

Use the Swagger UI at <http://localhost:8000/docs> to try the machine record endpoints. The API accepts machine type values `L`, `M`, or `H`; rotational speed, torque, and tool wear must be nonnegative. Creation requires a unique positive `udi`. PATCH accepts only fields to change, preserves omitted fields, rejects null values, and does not allow `udi` to be changed.

| Method | Endpoint | Result |
| --- | --- | --- |
| `POST` | `/api/machines` | Create a record (`201`); duplicate UDI returns `409` |
| `GET` | `/api/machines` | List records ordered by UDI, with `limit` and `offset` pagination (`200`) |
| `GET` | `/api/machines/{udi}` | Retrieve one record (`200`, or `404` if missing) |
| `PATCH` | `/api/machines/{udi}` | Partially update a record (`200`, or `404` if missing) |
| `DELETE` | `/api/machines/{udi}` | Delete a record (`204`, or `404` if missing) |
| `POST` | `/api/machines/import?filename=machines.csv` | Import CSV rows and return inserted, duplicate, invalid, and failed counts |
| `GET` | `/api/devices` | List devices ordered by device UID |
| `GET` | `/api/devices/{device_uid}` | Get a device and its parameters |
| `GET` | `/api/devices/{device_uid}/observations` | Get chronological observations; filter with `parameter`, timezone-aware `start`/`end`, numeric `min_value`/`max_value`, `limit`, and `offset` |

Observation requests select a parameter by its `name` within the device (for example, `parameter=air_temperature`). The device detail endpoint returns each parameter's `id`, `name`, and `data_type`; parameter names are unique within a device. Numeric `min_value` and `max_value` boundaries are inclusive, can be used independently or together, and are applied in the database before pagination. They are supported only for numeric parameters; text parameter requests using either filter and ranges where `min_value` exceeds `max_value` return HTTP 422. `start` and `end` are inclusive, timezone-aware timestamps. Results are ordered by timestamp and observation ID.

Example create request body:

```json
{
  "udi": 1,
  "product_id": "M14860",
  "type": "M",
  "air_temperature": 298.1,
  "process_temperature": 308.6,
  "rotational_speed": 1551,
  "torque": 42.8,
  "tool_wear": 0,
  "machine_failure": false,
  "twf": false,
  "hdf": false,
  "pwf": false,
  "osf": false,
  "rnf": false
}
```

The test suite exercises CRUD behavior, validation, duplicate and missing identifiers, and pagination using an isolated SQLite database. `make` targets are defined in the repository root, so run `make test-backend` from the root directory (`~/dataprophet`), not from `frontend/` or `backend/`. To run pytest directly without Docker, change to `backend/` and run `uv run --group dev pytest`.

The Sensor Data Explorer calls `/api/devices`, `/api/devices/{device_uid}`, and `/api/devices/{device_uid}/observations` through the shared frontend API client. Select a device to load its parameters, then choose a parameter and start/end date and time. Parameter names identify observations within the selected device. Numeric parameters expose optional inclusive minimum and maximum filters; text parameters do not. The explorer fetches observation pages in batches of 1,000 until the final partial page, and keeps the returned observation shape for the visualization work in Issue 4.

The date/time fields show the browser's local time. The submitted ISO timestamps include the corresponding timezone offset (UTC conversion), as required by FastAPI. The initial period is January 1–2, 2025, matching the simulated demonstration dataset; these timestamps are not live collection times. Set `VITE_API_BASE_URL` in `frontend/.env.local` for local development outside Compose, and allow that origin in `CORS_ORIGINS`. In Compose, Vite forwards API paths to the backend service.

To run the frontend checks, use `cd frontend && npm run build` and `npm run lint`. The project does not currently include a frontend test runner.

## Machine records interface

Start the integrated application with `make up`, then open <http://localhost:5173>. Use the **Single record** tab in the Record Details card to create a record, **View** to inspect every measurement and failure indicator, **Edit** to update a record while keeping its UDI fixed, and **Delete** to remove it after browser confirmation. The table is ordered by UDI and uses Previous/Next controls to load backend pages. Validation errors and API responses appear above the record controls. To load the sample records, run `make seed`.

The **Record Details** card has **Single record** and **Bulk CSV** tabs. Use **Single record** to create or edit one machine and **Bulk CSV** to upload a dataset. Choose a `.csv` file and select **Upload CSV**. The CSV must be UTF-8 and include all 14 machine columns. Both snake_case headers (such as `air_temperature`) and the original AI4I headers (such as `Air temperature [K]`) are accepted. The API accepts files up to 5 MiB and 10,000 data rows. Existing UDIs are skipped; invalid rows are skipped and reported with line numbers. The table reloads after the import, and the result lists inserted, duplicate, invalid, and failed counts.

The CSV endpoint is also available directly. It accepts the raw CSV request body (not multipart form data):

```sh
curl -X POST 'http://localhost:8000/api/machines/import?filename=machines.csv' \
  -H 'Content-Type: text/csv' \
  --data-binary @machines.csv
```

The page is responsive: the table can scroll horizontally on narrow screens, while the record form and detail view reflow to fit.

Screenshots are stored in [`docs/screenshots/`](docs/screenshots/). They should be captured from a running application with the bundled sample data loaded; see the validation status below for checks that have been completed in the current environment.

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
| `make seed` | Import sample CSV into PostgreSQL; duplicate UDIs remain unchanged | No |

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

Run the available checks from the service directories:

```sh
(cd backend && uv run --group dev pytest)
(cd frontend && npm run lint)
(cd frontend && npm run build)
```

Or run the Docker based backend test target from the repository root:

```sh
make test-backend
```

The frontend package does not yet include a UI test runner, so `make test-frontend` cannot run interaction tests until one is configured.

### Test coverage and isolation

Backend endpoint tests replace the application's database dependency with a fresh, in-memory SQLite database for each test. This exercises the FastAPI routes, SQLAlchemy persistence, response codes, validation, duplicate handling, pagination, and missing-record behavior without reading or changing the Compose PostgreSQL volume. Seed parsing and idempotency are tested separately with the same isolated database approach. The Compose PostgreSQL service is verified through the integrated startup and manual workflow described below; the pytest suite does not connect to PostgreSQL.

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

The backend pytest suite uses isolated SQLite databases and can be run with `make test-backend`. The frontend production build and lint checks can be run with the commands above. `docker compose config --quiet` validates the Compose file; use `make up`, `make ps`, and the URLs above to check a running stack. The frontend health indicator provides a browser-to-backend check. Database health is checked with `pg_isready`; the current backend health route is a liveness check and does not verify a database query. Use Swagger at <http://localhost:8000/docs> to explore device endpoints. For example, `GET /api/devices/demo-device-1/observations?parameter=air_temperature&start=2025-01-01T00:00:00Z&end=2025-01-02T00:00:00Z` returns observations in timestamp order.

## Design decisions and known limitations

- The dataset's positive `udi` is the record identifier, which keeps API paths aligned with the source CSV. It is immutable after creation.
- Pydantic schemas reject invalid API inputs before persistence, while SQLAlchemy constraints provide a second validation layer in the database.
- The repository layer owns database queries; the FastAPI routes translate expected validation, conflict, and missing-record conditions into HTTP responses.
- SQLite fixtures make backend tests independent and safe to run against a developer's data. They do not replace the Compose PostgreSQL integration check.
- The frontend has no automated interaction test runner yet. Verify create, view, edit, delete, confirmation cancellation, and validation feedback in the browser using the manual workflow above.
- Screenshots must be captured from a running browser session with sample data loaded. The current workspace has no browser executable or screenshot automation installed, so screenshots could not be generated here; do not treat this item as complete until `docs/screenshots/` contains the populated table, record details, and create or edit form images.
