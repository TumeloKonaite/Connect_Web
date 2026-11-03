# Connect_Web

## Local development with Docker Compose

Copy `.env.example` to `.env` and change the PostgreSQL password if needed. Start the stack from the repository root:

```sh
cp .env.example .env
make up
```

The frontend is available at <http://localhost:5173> and the API at <http://localhost:8000> (health check: <http://localhost:8000/health>). Frontend requests under `/api` are proxied by Vite to the backend. PostgreSQL is available to containers as `db:5432`; it is not published on the host. Its data is stored in the `connect-web-postgres-data` named volume and remains across `make down` / `make up` cycles. `docker compose down -v` removes that data.

## Makefile commands

Prerequisites: GNU Make and Docker with the Docker Compose v2 plugin must be installed, and the Docker daemon must be running. Run these commands from the repository root. The Makefile calls the root `docker-compose.yml` directly and uses the Compose project name `connect-web` by default; set `COMPOSE_PROJECT_NAME` to use another project name.

Run `make` or `make help` to list available commands:

```sh
make build          # Build all service images
make up             # Build and start all services in the background
make down           # Stop and remove containers; preserve PostgreSQL data
make restart        # Restart running services
make logs           # Follow logs from all services
make ps             # Show service/container status
make backend-logs    # Follow FastAPI logs
make frontend-logs   # Follow React/Vite logs
make db-logs         # Follow PostgreSQL logs
make backend-shell   # Open a shell in the running backend container
make frontend-shell  # Open a shell in the running frontend container
make test-backend    # Install backend dev dependencies and run pytest in Docker
make test-frontend   # Run the configured frontend test script in Docker
make test            # Run backend and frontend tests
make clean           # Remove stopped containers and networks; preserve data
make clean-data      # DESTRUCTIVE: also remove the PostgreSQL data volume
```

Recommended workflow: copy `.env.example` to `.env`, then use `make up`; use `make logs` or the service-specific log targets to troubleshoot, and `make down` when finished. Pressing Ctrl-C while following logs stops the log command only; Compose may report exit code 130 because it received an interrupt, and the services continue running. The `postgres_data` volume survives `make down` and `make clean`, so the database persists across routine stop/start cycles. `make clean-data` removes this volume and permanently deletes its contents.

The `make backend-shell` and `make frontend-shell` targets open a POSIX `sh` prompt in the selected container. Type `exit` or press Ctrl-D to leave it. The `\\q` command is for the PostgreSQL `psql` prompt, not a shell.

Backend tests use pytest installed from the backend development dependency group in a temporary Compose container. The frontend package currently has no `test` script or configured test runner. Consequently, `make test-frontend` reports this setup gap and exits with an error until a frontend test runner and script are added; `make test` propagates that result after running backend tests.
