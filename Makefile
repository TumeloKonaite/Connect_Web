COMPOSE := docker compose -p $(if $(COMPOSE_PROJECT_NAME),$(COMPOSE_PROJECT_NAME),connect-web)

.PHONY: build up down restart logs ps

build:
	$(COMPOSE) build

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps
