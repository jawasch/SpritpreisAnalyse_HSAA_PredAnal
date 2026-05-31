"""
Build recent_prices parquet from raw Tankerkönig daily CSVs.

Reads the last N days from tankerkoenig-data/prices/YYYY/MM/YYYY-MM-DD-prices.csv,
aggregates to hourly mean per station, and saves a lookup parquet used by the
backend to serve REAL price data for all 15k stations on the 3D map.

Output: data/processed/recent_prices_{fuel_type}_{days}d.parquet
Columns: lat, lng, name, brand, h00 … h23 (hourly avg price)
Index:   station_uuid

Run from project root:
    python scripts/build_recent_prices.py [--days 7] [--fuel diesel]
    python scripts/build_recent_prices.py --days 7 --fuel e5
"""
import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
STATIONS_GEO  = PROCESSED_DIR / "stations_geo.parquet"

# Allow override via env var (Docker: /app/data/tankerkoenig-data)
DATA_ROOT = Path(os.getenv("TANKERKOENIG_DATA_PATH",
                            str(PROJECT_ROOT.parent / "tankerkoenig-data")))


def find_csv_files(days: int) -> list[Path]:
    """Return the last `days` daily CSV files that exist, newest first."""
    today = datetime.now().date()
    files = []
    for offset in range(days + 10):          # look back a bit further for gaps
        d = today - timedelta(days=offset)
        path = DATA_ROOT / "prices" / str(d.year) / f"{d.month:02d}" / f"{d}-prices.csv"
        if path.exists():
            files.append(path)
        if len(files) >= days:
            break
    return files


def _read_csv(path: Path, fuel_type: str) -> pd.DataFrame:
    """Read one daily CSV, return (station_uuid, hour, price) rows."""
    try:
        df = pd.read_csv(path, usecols=["date", "station_uuid", fuel_type],
                         dtype={"station_uuid": str, fuel_type: "float32"})
        df = df[df[fuel_type] > 0.5]                       # filter invalid/zero prices
        df["dt"] = pd.to_datetime(df["date"], utc=True).dt.tz_convert("Europe/Berlin")
        df["hour"] = df["dt"].dt.hour
        return df[["station_uuid", "hour", fuel_type]].rename(columns={fuel_type: "price"})
    except Exception as e:
        print(f"  WARN: skipping {path.name}: {e}", file=sys.stderr)
        return pd.DataFrame(columns=["station_uuid", "hour", "price"])


def build(days: int = 7, fuel_type: str = "diesel") -> Path:
    print(f"Building recent_prices ({fuel_type}, last {days} days) …")
    print(f"  Data root: {DATA_ROOT}")

    csv_files = find_csv_files(days)
    if not csv_files:
        raise FileNotFoundError(
            f"No price CSVs found in {DATA_ROOT}. "
            "Run `git pull` in the tankerkoenig-data directory."
        )
    print(f"  Found {len(csv_files)} daily files: "
          f"{csv_files[-1].name} … {csv_files[0].name}")

    # Read all CSVs in parallel (I/O-bound)
    frames = []
    with ThreadPoolExecutor(max_workers=min(8, len(csv_files))) as pool:
        futures = {pool.submit(_read_csv, f, fuel_type): f for f in csv_files}
        for i, fut in enumerate(as_completed(futures), 1):
            frames.append(fut.result())
            print(f"  Loaded {i}/{len(csv_files)}", end="\r")
    print()

    combined = pd.concat(frames, ignore_index=True)
    print(f"  Rows read: {len(combined):,}  |  Unique stations: {combined['station_uuid'].nunique():,}")

    # Compute per-station, per-hour average over all N days
    hourly = (combined
              .groupby(["station_uuid", "hour"])["price"]
              .mean()
              .round(4)
              .reset_index())

    # Pivot to wide: index=station_uuid, cols=h00…h23
    wide = hourly.pivot(index="station_uuid", columns="hour", values="price")
    wide.columns = [f"h{c:02d}" for c in wide.columns]

    # Fill hours with no data using station's own overall mean
    station_mean = combined.groupby("station_uuid")["price"].mean().round(4)
    for col in [f"h{h:02d}" for h in range(24)]:
        if col not in wide.columns:
            wide[col] = np.nan
    wide = wide[[f"h{h:02d}" for h in range(24)]]  # ensure order
    wide = wide.apply(lambda row: row.fillna(station_mean.get(row.name, np.nan)), axis=1)

    # Drop stations where we have no valid prices at all
    wide = wide.dropna(how="all")

    # Join with station metadata (lat, lng, name, brand)
    if STATIONS_GEO.exists():
        geo = pd.read_parquet(STATIONS_GEO)[["uuid", "latitude", "longitude", "name", "brand"]]
        geo = geo.rename(columns={"uuid": "station_uuid",
                                  "latitude": "lat",
                                  "longitude": "lng"}).set_index("station_uuid")
        wide = wide.join(geo, how="left")
    else:
        print(f"  WARN: {STATIONS_GEO} not found, no geo metadata attached.")
        wide["lat"] = np.nan
        wide["lng"] = np.nan
        wide["name"] = ""
        wide["brand"] = ""

    out_path = PROCESSED_DIR / f"recent_prices_{fuel_type}_{days}d.parquet"
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    wide.to_parquet(out_path, compression="snappy")

    print(f"  Written: {out_path}  ({out_path.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  Stations with prices: {len(wide):,}")
    print(f"  Price range: {wide[[f'h{h:02d}' for h in range(24)]].values.min():.3f}"
          f" – {wide[[f'h{h:02d}' for h in range(24)]].values.max():.3f} €/L")
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days",  type=int, default=7,       help="Days to look back (default: 7)")
    parser.add_argument("--fuel",  type=str, default="diesel", help="Fuel type: diesel, e5, e10")
    args = parser.parse_args()
    build(days=args.days, fuel_type=args.fuel)
