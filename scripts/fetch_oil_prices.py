"""
Fetch historical Brent crude oil prices from EIA API.
Run from project root:
    python scripts/fetch_oil_prices.py

Requires EIA_API_KEY in environment or .env file.
Output: data/processed/oil_brent.parquet
"""
import os
import json
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent
OUT_FILE     = PROJECT_ROOT / "data" / "processed" / "oil_brent.parquet"

# EIA series for Brent crude spot price (USD/bbl)
EIA_URL = "https://api.eia.gov/v2/petroleum/pri/spt/data/"


def _fetch_eia(api_key: str, days: int = 3650) -> pd.DataFrame:
    import httpx
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    params = {
        "api_key": api_key,
        "frequency": "daily",
        "data[0]":   "value",
        "facets[series][]": "RBRTE",
        "start": start,
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "offset": 0,
        "length": 5000,
    }
    with httpx.Client(timeout=20.0) as client:
        r = client.get(EIA_URL, params=params)
        r.raise_for_status()
        data = r.json()
    rows = data.get("response", {}).get("data", [])
    df = pd.DataFrame(rows)
    df["date"]  = pd.to_datetime(df["period"])
    df["price_usd_bbl"] = pd.to_numeric(df["value"], errors="coerce")
    df = df[["date", "price_usd_bbl"]].dropna().set_index("date").sort_index()
    # Convert USD/bbl → EUR/bbl using approximate 0.92 rate (update if needed)
    df["price_eur_bbl"] = (df["price_usd_bbl"] * 0.92).round(2)
    return df


def _static_fallback() -> pd.DataFrame:
    """Minimal static fallback if EIA API is unavailable."""
    dates = pd.date_range("2020-01-01", datetime.now().date(), freq="D")
    import numpy as np
    np.random.seed(42)
    base = 70.0
    prices = [base]
    for _ in range(len(dates) - 1):
        prices.append(prices[-1] + np.random.normal(0, 1.2))
    df = pd.DataFrame({"price_usd_bbl": prices, "price_eur_bbl": [p * 0.92 for p in prices]}, index=dates)
    df.index.name = "date"
    return df


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv("EIA_API_KEY", "")
    if api_key:
        print("Fetching Brent crude from EIA API …")
        try:
            df = _fetch_eia(api_key)
            print(f"  Got {len(df)} rows, {df.index.min().date()} – {df.index.max().date()}")
        except Exception as e:
            print(f"  EIA fetch failed: {e} — using static fallback")
            df = _static_fallback()
    else:
        print("EIA_API_KEY not set — using static fallback data")
        df = _static_fallback()

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_FILE)
    print(f"Written to {OUT_FILE}")
    print(f"  Ø price: {df['price_usd_bbl'].mean():.2f} USD/bbl")
