# ── Spritpreis Analytics — Dev Shortcuts ─────────────────────────────────────
.DEFAULT_GOAL := help
.PHONY: help dev down logs test lint format install clean db shell-backend shell-db

COMPOSE = docker compose
BACKEND = $(COMPOSE) exec backend
VENV    = backend/venv/bin

help:         ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"}{printf "\033[36m%-18s\033[0m %s\n",$$1,$$2}'

# ── Stack ─────────────────────────────────────────────────────────────────────

dev:          ## Start full stack (backend + frontend + db) with hot reload
	$(COMPOSE) up

dev-db:       ## Start only the database
	$(COMPOSE) up db

dev-admin:    ## Start stack + pgAdmin (http://localhost:5050)
	$(COMPOSE) --profile dev up

down:         ## Stop and remove containers
	$(COMPOSE) down

down-v:       ## Stop containers and delete all volumes (resets DB)
	$(COMPOSE) down -v

logs:         ## Tail logs for all services
	$(COMPOSE) logs -f

logs-be:      ## Tail backend logs only
	$(COMPOSE) logs -f backend

logs-fe:      ## Tail frontend logs only
	$(COMPOSE) logs -f frontend

# ── Backend ───────────────────────────────────────────────────────────────────

install:      ## Install backend Python deps into venv
	cd backend && python -m venv venv && venv/bin/pip install -r requirements.txt

test:         ## Run backend tests (inside container if running, else venv)
	@if $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(BACKEND) pytest tests/ -v --tb=short; \
	else \
		cd backend && $(VENV)/pytest tests/ -v --tb=short; \
	fi

test-cov:     ## Run tests with coverage report
	@if $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(BACKEND) pytest tests/ -v --cov=app --cov-report=term-missing; \
	else \
		cd backend && $(VENV)/pytest tests/ -v --cov=app --cov-report=term-missing; \
	fi

lint:         ## Run flake8 + mypy on backend
	@if $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(BACKEND) sh -c "flake8 app/ && mypy app/"; \
	else \
		cd backend && $(VENV)/flake8 app/ && $(VENV)/mypy app/; \
	fi

format:       ## Auto-format backend code with black
	@if $(COMPOSE) ps backend 2>/dev/null | grep -q "Up"; then \
		$(BACKEND) black app/ tests/; \
	else \
		cd backend && $(VENV)/black app/ tests/; \
	fi

shell-backend: ## Open a shell in the running backend container
	$(BACKEND) bash

shell-db:     ## Open psql inside the running db container
	$(COMPOSE) exec db psql -U spritpreis -d spritpreis_analytics

# ── Database ─────────────────────────────────────────────────────────────────

migrate:      ## Run Alembic migrations
	$(BACKEND) alembic upgrade head

migration:    ## Create a new migration (usage: make migration MSG="add column")
	$(BACKEND) alembic revision --autogenerate -m "$(MSG)"

# ── Frontend ──────────────────────────────────────────────────────────────────

fe-install:   ## Install frontend npm deps
	cd frontend && npm install

fe-lint:      ## Lint frontend code
	cd frontend && npm run lint

fe-format:    ## Format frontend code with prettier
	cd frontend && npm run format

fe-build:     ## Production build of frontend
	cd frontend && npm run build

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:        ## Remove Python caches and build artifacts
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/.mypy_cache backend/.pytest_cache backend/htmlcov
