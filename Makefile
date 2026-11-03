# Run Docker Compose with the same project name used by docker-compose.yml.
COMPOSE_PROJECT_NAME ?= connect-web
COMPOSE = docker compose -f $(CURDIR)/docker-compose.yml -p $(COMPOSE_PROJECT_NAME)

.DEFAULT_GOAL := help
.PHONY: help build up down restart logs ps backend-logs frontend-logs db-logs \
	backend-shell frontend-shell test test-backend test-frontend clean clean-data

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; print "Usage: make <target>\n\nTargets:"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all service images
	@$(COMPOSE) build || { echo "Error: Docker Compose could not build the services. Check Docker is running and the Compose configuration is valid." >&2; exit 1; }

up: ## Build and start all services in the background
	@$(COMPOSE) up --build -d || { echo "Error: Could not start the application. Check Docker is running and inspect logs with 'make logs'." >&2; exit 1; }

down: ## Stop and remove application containers (preserves database data)
	@$(COMPOSE) down

restart: ## Restart running services
	@$(COMPOSE) restart || { echo "Error: Could not restart services. Start the stack with 'make up' first." >&2; exit 1; }

logs: ## Follow logs from all services
	@$(COMPOSE) logs -f

ps: ## Show service/container status
	@$(COMPOSE) ps

backend-logs: ## Follow FastAPI backend logs
	@$(COMPOSE) logs -f backend

frontend-logs: ## Follow React/Vite frontend logs
	@$(COMPOSE) logs -f frontend

db-logs: ## Follow PostgreSQL logs
	@$(COMPOSE) logs -f db

backend-shell: ## Open a shell in the running backend container
	@$(COMPOSE) exec backend sh || { echo "Error: Backend is unavailable. Start it with 'make up' and check 'make ps'." >&2; exit 1; }

frontend-shell: ## Open a shell in the running frontend container
	@$(COMPOSE) exec frontend sh || { echo "Error: Frontend is unavailable. Start it with 'make up' and check 'make ps'." >&2; exit 1; }

test: ## Run backend and frontend test targets
	@$(MAKE) --no-print-directory test-backend
	@$(MAKE) --no-print-directory test-frontend

test-backend: ## Run backend pytest suite in a temporary test container
	@$(COMPOSE) run --rm --build --no-deps -v "$(CURDIR)/backend/tests:/app/tests:ro" -w /app backend sh -c 'uv sync --frozen && uv run --no-sync pytest /app/tests' || { echo "Error: Backend tests failed. Ensure Docker is running and backend dependencies can be installed." >&2; exit 1; }

test-frontend: ## Run frontend tests if a test script is configured
	@$(COMPOSE) run --rm --no-deps frontend sh -c 'node -e '\''const p = require("./package.json"); if (!p.scripts || !p.scripts.test) { console.error("Error: No frontend test runner is configured in frontend/package.json."); process.exit(2); }'\'' && npm test -- --run' || { echo "Error: Frontend tests failed. Check the frontend test runner and Docker configuration." >&2; exit 1; }

clean: ## Remove stopped application containers and networks; preserve database volume
	@$(COMPOSE) down --remove-orphans

clean-data: ## DESTRUCTIVE: remove application containers, networks, and PostgreSQL data volume
	@echo "Removing the PostgreSQL volume permanently..."
	@$(COMPOSE) down --remove-orphans --volumes
