"""
EDA API — serves pre-computed exploratory data analysis summary.
Run scripts/build_eda_summary.py once to generate data/processed/eda_summary.json.
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
EDA_FILE = DATA_DIR / "processed" / "eda_summary.json"
SPEDITION_PARQUET = DATA_DIR / "processed" / "spedition_5stations_diesel_all_all.parquet"

# Route → (display label, colour) — mirrors ROUTE_META in ml_service for visual coherence.
ROUTE_INFO = {
    "Route_E":  ("E · ESSO Olching",    "#f59e0b"),
    "Route_N":  ("N · AVIA Ipsheim",    "#3b82f6"),
    "Route_NE": ("NE · AVIA Nürnberg",  "#8b5cf6"),
    "Route_NW": ("NW · AVIA Mühlhausen", "#22c55e"),
    "Route_SW": ("SW · RAN Biberach",   "#ef4444"),
}


@router.get("/summary")
async def get_eda_summary():
    """Return pre-computed EDA summary (census, outliers, coverage, distributions)."""
    if not EDA_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "EDA summary not found. "
                "Run `python scripts/build_eda_summary.py` from the project root "
                "to generate data/processed/eda_summary.json."
            ),
        )
    with EDA_FILE.open(encoding="utf-8") as f:
        return json.load(f)


@router.get("/intraday-by-region")
async def get_intraday_by_region():
    """
    Mean diesel price per hour-of-day, split by the 5 routes/regions
    (E, N, NE, NW, SW) — the "Intraday-Profil … je Stunde und Region" from
    spedition_mlp.ipynb. Computed live from the 5-station hourly parquet.
    """
    if not SPEDITION_PARQUET.exists():
        raise HTTPException(
            status_code=404,
            detail="Spedition parquet not found (data/processed/spedition_5stations_diesel_all_all.parquet).",
        )
    import pandas as pd

    df = pd.read_parquet(SPEDITION_PARQUET).copy()
    df["hour"] = df.index.hour
    cols = [c for c in df.columns if c.startswith("diesel_Route_")]
    means = df.groupby("hour")[cols].mean()

    regions = []
    for c in cols:
        route = c.replace("diesel_", "")  # "Route_E"
        label, color = ROUTE_INFO.get(route, (route, "#888888"))
        regions.append({
            "route":  route,
            "label":  label,
            "color":  color,
            "points": [{"hour": int(h), "avg_price": round(float(v), 4)} for h, v in means[c].items()],
        })
    return {"regions": regions}
