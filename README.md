# Connect_Web

## Local development with Docker Compose

Copy `.env.example` to `.env` and change the PostgreSQL password if needed. Start the stack from the repository root:

```sh
cp .env.example .env
make up
```

The frontend is available at <http://localhost:5173> and the API at <http://localhost:8000> (health check: <http://localhost:8000/health>). Frontend requests under `/api` are proxied by Vite to the backend. PostgreSQL is available to containers as `db:5432`; it is not published on the host. Its data is stored in the `connect-web-postgres-data` named volume and remains across `make down` / `make up` cycles. `docker compose down -v` removes that data.

Useful commands:

```sh
make build    # Build all images
make up       # Build and start the stack
make down     # Stop and remove containers
make restart  # Restart running services
make logs     # Follow service logs
make ps       # Show service status
```
