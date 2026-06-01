import os
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query
from ..services.tankerkoenig import service

router = APIRouter()

_PROCESSED = Path(os.getenv("DATA_DIR", "/app/data")) / "processed"
_SPEDITION = _PROCESSED / "spedition_5stations_diesel_all_all.parquet"


@router.get("/heatmap")
async def get_heatmap(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
):
    return await service.get_heatmap_data(fuel_type)


@router.get("/price-heatmaps")
async def get_price_heatmaps(weeks: int = Query(4, ge=1, le=12)):
    """
    Two diesel price heatmaps from the 5-station history (avg across stations):
      • weekday_hour : 7×24 grid averaged over ALL years
      • recent       : the last `weeks` weeks, per day × hour (live recent prices)
    Returns ECharts-ready [xHour, yIndex, price] arrays.
    """
    if not _SPEDITION.exists():
        return {"ok": False, "error": f"parquet fehlt: {_SPEDITION.name}"}

    df = pd.read_parquet(_SPEDITION)
    cols = [c for c in df.columns if c.startswith("diesel_Route_")]
    s = df[cols].mean(axis=1)
    s = s[(s > 0.5) & (s < 3.5)]

    # ── All-years weekday × hour average ─────────────────────────────────────
    wh = s.groupby([s.index.dayofweek, s.index.hour]).mean()
    wh_data = [[int(h), int(d), round(float(v), 3)] for (d, h), v in wh.items()]
    wh_vals = [v for *_, v in wh_data]

    # ── Recent N weeks, per day × hour ───────────────────────────────────────
    last = s.index.max().normalize()
    start = last - pd.Timedelta(days=weeks * 7 - 1)
    rec = s[s.index >= start]
    rh = rec.groupby([rec.index.normalize(), rec.index.hour]).mean()
    days = sorted({d for d, _ in rh.index})
    day_idx = {d: i for i, d in enumerate(days)}
    rec_data = [[int(h), day_idx[d], round(float(v), 3)] for (d, h), v in rh.items()]
    rec_vals = [v for *_, v in rec_data]

    return {
        "ok": True,
        "weekday_hour": {
            "data": wh_data,
            "weekdays": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
            "min": round(min(wh_vals), 3), "max": round(max(wh_vals), 3),
            "overall_avg": round(float(s.mean()), 3),
        },
        "recent": {
            "data": rec_data,
            "dates": [str(d.date()) for d in days],
            "min": round(min(rec_vals), 3) if rec_vals else 0,
            "max": round(max(rec_vals), 3) if rec_vals else 0,
            "start": str(days[0].date()) if days else None,
            "end": str(days[-1].date()) if days else None,
            "weeks": weeks,
        },
    }


@router.get("/region-history")
async def get_region_history(fuel: str = Query("diesel", pattern="^(diesel|e5|e10)$")):
    """
    All-years regional price animation for the map: ~95 PLZ-2 regions, one frame per
    ISO week, value = avg price of the chosen fuel across the region's stations.
    Returns map-ready stations (one per region) each with an aligned `prices` array.
    """
    hp = _PROCESSED / "region_history.parquet"
    mp = _PROCESSED / "region_meta.parquet"
    if not hp.exists() or not mp.exists():
        return {"ok": False, "stations": [],
                "error": "region_history fehlt — scripts/build_region_history.py ausführen"}

    hist = pd.read_parquet(hp)
    meta = pd.read_parquet(mp).set_index("plz2")

    dates = sorted(pd.Timestamp(d) for d in hist["date"].unique())
    date_iso = [d.isoformat() for d in dates]
    date_idx = {d: i for i, d in enumerate(dates)}
    n = len(dates)

    stations = []
    for plz2, grp in hist.groupby("plz2"):
        if plz2 not in meta.index or plz2 == "00":   # "00" = bucket of deleted stations
            continue
        m = meta.loc[plz2]
        if int(m["n_stations"]) < 2:                 # drop noise regions
            continue
        series = [None] * n
        for d, v in zip(grp["date"], grp[fuel]):
            if pd.notna(v):
                series[date_idx[pd.Timestamp(d)]] = round(float(v), 3)
        stations.append({
            "id": plz2, "name": str(m["label"]), "brand": f"{int(m['n_stations'])} Stationen",
            "lat": float(m["lat"]), "lng": float(m["lng"]),
            "prices": [{"timestamp": date_iso[i], "price": series[i]} for i in range(n)],
        })

    return {
        "ok": True,
        "stations": stations,
        "meta": {
            "scenario": "all", "fuel_type": fuel, "n_stations": len(stations),
            "n_frames": n, "date": str(dates[-1].date()) if dates else None,
            "start": str(dates[0].date()) if dates else None,
            "end": str(dates[-1].date()) if dates else None,
            "data_source": "region_history (PLZ-2 · wöchentlich · alle Jahre)",
        },
    }


@router.get("/best-time")
async def get_best_time(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
):
    return await service.get_best_time(fuel_type)


@router.get("/geo/timeseries")
async def get_geo_timeseries(
    fuel_type: str = Query("diesel", pattern="^(e5|e10|diesel)$"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to today"),
    interval: str = Query("hour", pattern="^(hour|day)$"),
    region: str = Query("bw", pattern="^(bw|all)$"),
    scenario: str = Query("all", pattern="^(all|spedition|b29|germany)$"),
):
    """
    Geo-temporal timeseries for the 3D map visualisation.

    scenario="all"       — All 15k German stations (estimated prices from parquet)
    scenario="spedition" — 5 Spedition route stations with MLP-predicted 24h prices
    scenario="b29"       — 4 B29 cluster centroids with MLP-predicted 24h prices
    scenario="germany"   — National grid model (falls back to "all" if not trained yet)
    """
    return await service.get_geo_timeseries(fuel_type, date, interval, region, scenario)
