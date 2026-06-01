import os
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Query

from ..services.tankerkoenig import service

router = APIRouter()

_PROCESSED = Path(os.getenv("DATA_DIR", "/app/data")) / "processed"

# Long-term per-station diesel series (the 5 Spedition routes) — used by the
# interactive Langzeit-Preisverlauf chart on the Data-Exploration page.
_ROUTE_META = {
    "diesel_Route_N":  {"label": "N · Ipsheim",    "color": "#3b82f6"},
    "diesel_Route_NE": {"label": "NE · Nürnberg",  "color": "#8b5cf6"},
    "diesel_Route_E":  {"label": "E · Olching",    "color": "#f59e0b"},
    "diesel_Route_NW": {"label": "NW · Mühlhausen", "color": "#ef4444"},
    "diesel_Route_SW": {"label": "SW · Biberach",  "color": "#22c55e"},
}
_RESAMPLE = {"day": "D", "week": "W", "month": "ME"}


@router.get("/current")
async def get_current_prices(
    ids: str = Query(..., description="Comma-separated station UUIDs (max 10)"),
):
    station_ids = [s.strip() for s in ids.split(",") if s.strip()][:10]
    return await service.get_prices_for_stations(station_ids)


@router.get("/history")
async def get_price_history(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
    days: int = Query(30, ge=1, le=365),
):
    return await service.get_price_history(fuel_type, days)


@router.get("/longterm")
async def get_longterm_prices(
    resolution: str = Query("week", pattern="^(day|week|month)$"),
):
    """
    Full-history diesel price series for the 5 Spedition stations + their average,
    resampled to day/week/month. Returns ECharts-ready [timestamp_ms, price] points.
    """
    p = _PROCESSED / "spedition_5stations_diesel_all_all.parquet"
    if not p.exists():
        return {"ok": False, "series": [], "error": f"parquet fehlt: {p.name}"}

    df = pd.read_parquet(p)
    cols = [c for c in df.columns if c in _ROUTE_META]
    if not cols:
        return {"ok": False, "series": [], "error": "keine Stations-Spalten"}

    res = df[cols].resample(_RESAMPLE[resolution]).mean().dropna(how="all")

    def points(s):
        s = s.dropna()
        return [[int(ts.timestamp() * 1000), round(float(v), 3)] for ts, v in s.items()]

    series = [
        {"key": c, "label": _ROUTE_META[c]["label"], "color": _ROUTE_META[c]["color"],
         "data": points(res[c])}
        for c in cols
    ]
    series.append({
        "key": "avg", "label": "Ø Durchschnitt", "color": "#1c1c1a",
        "data": points(res[cols].mean(axis=1)),
    })

    return {
        "ok": True,
        "resolution": resolution,
        "series": series,
        "start": str(res.index.min().date()),
        "end": str(res.index.max().date()),
        "n_points": int(len(res)),
    }


_PERIOD = {"month": "M", "quarter": "Q", "week": "W"}


@router.get("/distribution")
async def get_price_distribution(
    resolution: str = Query("month", pattern="^(month|quarter|week)$"),
    bin: float = Query(0.02, ge=0.005, le=0.1),
):
    """
    2D frequency of observed hourly diesel prices: for each (time bucket × price class)
    the number of observations across the 5 Spedition stations. Feeds the dot-matrix
    cloud (x = time, y = price, size/colour = count).
    """
    p = _PROCESSED / "spedition_5stations_diesel_all_all.parquet"
    if not p.exists():
        return {"ok": False, "points": [], "error": f"parquet fehlt: {p.name}"}

    df = pd.read_parquet(p)
    cols = [c for c in df.columns if c in _ROUTE_META]

    long = df[cols].stack().reset_index()
    long.columns = ["timestamp", "route", "price"]
    # Clip to the realistic band (same as the EDA histogram) so rare outliers
    # don't stretch the chart's price axis.
    long = long[(long["price"] >= 0.8) & (long["price"] <= 3.5)]

    long["t"] = long["timestamp"].dt.to_period(_PERIOD[resolution]).dt.start_time
    long["pbin"] = (long["price"] / bin).round() * bin

    g = long.groupby(["t", "pbin"]).size().reset_index(name="count")
    points = [
        [int(t.timestamp() * 1000), round(float(pb), 3), int(c)]
        for t, pb, c in zip(g["t"], g["pbin"], g["count"])
    ]

    return {
        "ok": True,
        "resolution": resolution,
        "bin": bin,
        "points": points,
        "max_count": int(g["count"].max()) if len(g) else 0,
        "price_min": round(float(long["price"].min()), 2),
        "price_max": round(float(long["price"].max()), 2),
        "n_obs": int(len(long)),
    }
