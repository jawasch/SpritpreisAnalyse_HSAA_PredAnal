"""
Spritpreis Analytics Dashboard - FastAPI Backend
Serves ML forecasts from joblib models + parquet files (no database required).
"""
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import (
    analytics, eda, models_api, notebooks, oil,
    predictions, prices, recent_prices, setup, stations,
)

load_dotenv()

app = FastAPI(
    title="Spritpreis Analytics API",
    description="CRISP-DM Fuel-Price Analytics — joblib models + parquet, no DB required.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
async def root():
    return {
        "status": "online",
        "message": "Spritpreis Analytics API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    from .services.ml_service import (
        ALL_GERMANY_MODELS, B29_MODEL, B29_PARQUET,
        DATA_DIR, SPEDITION_MODEL, SPEDITION_PARQUET, STATIONS_GEO,
    )
    from .api.notebooks import NOTEBOOKS_DIR

    models = {
        "spedition_mlp":      SPEDITION_MODEL.exists(),
        "b29_mlp":            B29_MODEL.exists(),
        "all_germany_diesel": ALL_GERMANY_MODELS["diesel"].exists(),
        "all_germany_e5":     ALL_GERMANY_MODELS["e5"].exists(),
        "all_germany_e10":    ALL_GERMANY_MODELS["e10"].exists(),
    }
    proc_dir = DATA_DIR / "processed"
    parquets = {
        "spedition_5stations": SPEDITION_PARQUET.exists(),
        "b29_hourly":          B29_PARQUET.exists(),
        "stations_geo":        STATIONS_GEO.exists(),
        "eda_summary":         (proc_dir / "eda_summary.json").exists(),
        "oil_brent":           (proc_dir / "oil_brent.parquet").exists(),
        "recent_prices_7d":    (proc_dir / "recent_prices_diesel_7d.parquet").exists(),
    }
    all_ok = models["spedition_mlp"] and models["all_germany_diesel"]
    return {
        "status":        "healthy" if all_ok else "degraded",
        "data_dir":      str(DATA_DIR),
        "notebooks_dir": str(NOTEBOOKS_DIR),
        "models":        models,
        "parquets":      parquets,
        "tankerkoenig_data_available": (DATA_DIR / "tankerkoenig-data").exists(),
    }


# ── Startup hook: auto-run setup if RUN_SETUP_ON_START=true ──────────────────

@app.on_event("startup")
async def on_startup():
    if os.getenv("RUN_SETUP_ON_START", "false").lower() == "true":
        import logging
        logging.getLogger(__name__).info(
            "[setup] RUN_SETUP_ON_START=true — triggering background setup …"
        )
        asyncio.create_task(_deferred_setup())


async def _deferred_setup():
    """Run setup 3 seconds after startup (give the server time to be ready)."""
    await asyncio.sleep(3)
    from .api.setup import _state, _run_script, COMPONENTS, DATA_DIR as _DATA_DIR
    _state["done"] = False
    for comp in COMPONENTS:
        if not comp.get("script"):
            continue
        if (_DATA_DIR / comp["path"]).exists():
            continue
        await _run_script(comp["id"], comp["script"])
    _state["done"] = True


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(stations.router,      prefix="/api/v1/stations",           tags=["Stations"])
app.include_router(prices.router,        prefix="/api/v1/prices",             tags=["Prices"])
app.include_router(recent_prices.router, prefix="/api/v1/prices",             tags=["Prices"])
app.include_router(analytics.router,     prefix="/api/v1/analytics",          tags=["Analytics"])
app.include_router(predictions.router,   prefix="/api/v1/predictions",        tags=["Predictions"])
app.include_router(notebooks.router,     prefix="/api/v1/notebooks",          tags=["Notebooks"])
app.include_router(eda.router,           prefix="/api/v1/eda",                tags=["EDA"])
app.include_router(models_api.router,    prefix="/api/v1/models",             tags=["Models"])
app.include_router(oil.router,           prefix="/api/v1/oil",                tags=["Oil"])
app.include_router(setup.router,         prefix="/api/v1/setup",              tags=["Setup"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, log_level="info")
