"""
Oil price API — serves Brent crude price history from local parquet.
Run scripts/fetch_oil_prices.py to generate data/processed/oil_brent.parquet.
"""
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_DIR  = Path(os.getenv("DATA_DIR", "/app/data"))
OIL_FILE  = DATA_DIR / "processed" / "oil_brent.parquet"


@router.get("/history")
async def oil_history(days: int = 365):
    """Return daily Brent crude prices (USD + EUR per barrel)."""
    if not OIL_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Oil price parquet not found. "
                "Run `python scripts/fetch_oil_prices.py` to generate it."
            ),
        )
    import pandas as pd
    df = pd.read_parquet(OIL_FILE)
    tail = df.iloc[-days:]
    data = [
        {
            "date":          str(ts.date()),
            "price_usd_bbl": round(float(row["price_usd_bbl"]), 2),
            "price_eur_bbl": round(float(row["price_eur_bbl"]), 2),
        }
        for ts, row in tail.iterrows()
        if not any(v != v for v in [row["price_usd_bbl"], row["price_eur_bbl"]])
    ]
    return {"ok": True, "data": data, "n": len(data)}
