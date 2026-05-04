# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Studienprojekt (HS Aalen, Sem 1 – Predictive Analytics): A fuel price analytics dashboard for Germany, pulling data from the Tankerkönig API (14,000+ stations) and EIA API (crude oil prices), with ML forecasting (Prophet, LSTM, ARIMA) and a React/D3.js frontend.

## Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Tests
pytest
pytest tests/path/to/test_file.py::test_name  # single test
pytest --cov=app tests/

# Linting / formatting
flake8 app/
black app/
mypy app/
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server on :3000
npm run build
npm run lint
npm run format
```

### Docker (full stack)
```bash
docker-compose up          # starts db + backend + frontend
docker-compose up db       # just PostgreSQL
docker-compose --profile dev up  # includes pgAdmin at :5050
```

API docs available at `http://localhost:8000/docs` (Swagger) and `/redoc`.

## Architecture

### Backend (`backend/`)
- **`app/main.py`** — FastAPI entry point; CORS configured via `ALLOWED_ORIGINS` env var. API routers are not yet wired in (TODOs present for `/api/v1/prices`, `/predictions`, `/analytics`, `/stations`).
- **`app/database.py`** — SQLAlchemy engine + `SessionLocal`; `get_db()` is the FastAPI dependency for DB sessions; `init_db()` creates tables directly (use Alembic for migrations instead).
- **`app/models/models.py`** — Six SQLAlchemy models: `GasStation`, `FuelPrice`, `CrudeOilPrice`, `PoliticalEvent`, `Prediction`, `ModelMetadata`. `FuelType` and `StationStatus` are Python enums mapped to PG enums.
- **`app/schemas/schemas.py`** — Pydantic v2 schemas (Base/Create/Response pattern) mirroring each model, plus search/analytics response shapes.
- **`app/api/`** — Placeholder; routers for `prices`, `stations`, `predictions`, `analytics`, `oil_prices` need to be created here.
- **`app/services/`** — Placeholder; `TankerkoenigService`, `EIAService`, `PredictionService`, scheduled jobs (APScheduler) go here.
- **`app/ml/`** — Placeholder; `ProphetModel`, `LSTMModel`, `ARIMAModel`, `FeatureEngineer`, `ModelEvaluator` go here.
- **`alembic/`** — Migration config uses `Europe/Berlin` timezone; `env.py` imports all models via `from app.models.models import *`.

### Frontend (`frontend/`)
- Vite + React 18, currently a single placeholder `App.jsx`.
- Dependencies already in `package.json`: React Router, Axios, D3 v7, Leaflet/React-Leaflet, Tailwind CSS.
- API base URL configured via `VITE_API_URL` env var.

### Database schema key points
- `GasStation.id` is a UUID string (from Tankerkönig), not auto-increment.
- `FuelPrice` has composite indexes on `(station_id, timestamp)` and `(fuel_type, timestamp)` — keep these in mind for query design.
- `CrudeOilPrice` has a unique constraint on `(oil_type, date)`.
- `Prediction` stores model name (`prophet`/`lstm`/`arima`), fuel type, the date the prediction was made, and the target date.

### Environment variables (see `.env.example`)
Required: `DATABASE_URL`, `TANKERKOENIG_API_KEY`, `EIA_API_KEY`, `SECRET_KEY`  
Optional: `ALLOWED_ORIGINS`, `DATA_FETCH_INTERVAL`, `MODEL_RETRAIN_INTERVAL`, ML hyperparameter vars, `LOG_LEVEL`

## Development Status

The project is early-stage scaffolding. Database models and schemas are complete (Issue #2 done). All API routes, services, ML models, and frontend components remain to be implemented. See `ISSUES.md` for the full 33-issue roadmap across 6 phases.
