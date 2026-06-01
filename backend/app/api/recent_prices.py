"""
Recent Prices API — serves real historical station prices from recent_prices parquet.

GET /api/v1/prices/all-stations?fuel_type=diesel&days=7
Returns per-station hourly average prices (real data) for use in the 3D map.
Falls back gracefully if parquet doesn't exist yet.
"""
import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

DATA_DIR      = Path(os.getenv("DATA_DIR", "/app/data"))
PROCESSED_DIR = DATA_DIR / "processed"


@router.get("/all-stations")
async def get_all_station_prices(fuel_type: str = "diesel", days: int = 7):
    """
    Return hourly average prices (h00–h23) for all available stations.
    Data source: recent_prices_{fuel_type}_{days}d.parquet (built by build_recent_prices.py).
    """
    parquet_path = PROCESSED_DIR / f"recent_prices_{fuel_type}_{days}d.parquet"

    if not parquet_path.exists():
        return {
            "ok":      False,
            "available": False,
            "message": (
                f"recent_prices_{fuel_type}_{days}d.parquet not found. "
                f"Use the Setup page or run: python scripts/build_recent_prices.py "
                f"--fuel {fuel_type} --days {days}"
            ),
            "stations": [],
        }

    import pandas as pd
    df = pd.read_parquet(parquet_path)

    hour_cols = [f"h{h:02d}" for h in range(24)]
    available_hours = [c for c in hour_cols if c in df.columns]

    stations = []
    for uuid, row in df.iterrows():
        lat  = row.get("lat")
        lng  = row.get("lng")
        if lat != lat or lng != lng:   # NaN check
            continue
        hourly = {col: round(float(row[col]), 4) if row[col] == row[col] else None
                  for col in available_hours}
        # Compute 24h mean as overall price
        prices = [v for v in hourly.values() if v is not None]
        if not prices:
            continue
        stations.append({
            "id":     str(uuid),
            "name":   str(row.get("name", "")),
            "brand":  str(row.get("brand", "")),
            "lat":    float(lat),
            "lng":    float(lng),
            "hourly": hourly,
            "avg":    round(sum(prices) / len(prices), 4),
        })

    return {
        "ok":        True,
        "available": True,
        "fuel_type": fuel_type,
        "days":      days,
        "n_stations": len(stations),
        "mtime":     parquet_path.stat().st_mtime,
        "stations":  stations,
    }


@router.get("/all-stations/available")
async def check_available():
    """Quick check: is the recent_prices parquet available?"""
    results = {}
    for fuel in ("diesel", "e5", "e10"):
        for days in (7,):
            key = f"{fuel}_{days}d"
            path = PROCESSED_DIR / f"recent_prices_{fuel}_{days}d.parquet"
            results[key] = {
                "available": path.exists(),
                "path":      str(path),
                "size_mb":   round(path.stat().st_size / 1024 / 1024, 1) if path.exists() else None,
            }
    return results
