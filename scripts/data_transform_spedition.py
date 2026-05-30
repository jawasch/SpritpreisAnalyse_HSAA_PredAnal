"""
Spedition Data Loader — MLP Regressor feature pipeline for 5-station routing.

Unlike the B29DataLoader (which averages stations into 4 geographic clusters),
this loader works with 5 individual station price histories. The business context
is a Spedition with 5 trucks on 5 fixed routes, each passing one specific station
at roughly equal distance (~100 km) from Aalen. The goal is to predict the
cheapest station over the next 72 hours.

Station UUIDs are discovered interactively in the spedition_mlp notebook
(Station Discovery section) and hardcoded below after the map selection.

Usage
-----
    from scripts.data_transform_spedition import SpeditionDataLoader

    loader = SpeditionDataLoader(
        train_end="2021-12-31 23:00",
        val_end="2023-12-31 23:00",
        forecast_horizon=72,
        fuel_type="diesel",
        debug=True,
    )
    X, y  = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)

CLI
---
    python scripts/data_transform_spedition.py [--refresh] [--debug]
"""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm.auto import tqdm

# Reuse constants and helpers from the B29 pipeline unchanged
from scripts.data_transform import (
    LAG_HOURS,
    ROLLING_WINDOWS,
    TREND_WINDOW,
    WARMUP_ROWS,
    _is_holiday,
    _rolling_linear_slope,
    load_config,
)

# ── Station registry ────────────────────────────────────────────────────────
# Populated after the Station Discovery section in spedition_mlp.ipynb.
# Keys are human-readable route names; values are Tankerkönig UUIDs.
SPEDITION_STATIONS: dict[str, str] = {
    "Route_E":  "19275bf1-8186-47d8-b5eb-261431afaced",  # ESSO Esso Tankstelle — OLCHING (114 km)
    "Route_N":  "af8b14d6-0af5-4d86-a2d5-947dc569fd9a",  # AVIA AVIA Station — Ipsheim (81 km)
    "Route_NE": "db307731-f6c4-4c45-9af4-1058e9b23397",  # AVIA AVIA Tankstelle — Nürnberg (90 km)
    "Route_NW": "7bbb852b-e04e-48db-a1ee-8835cdbb9757",  # AVIA AVIA Tankstelle — Mühlhausen (109 km)
    "Route_SW": "62c42eb1-3776-4c5c-aec5-22148a267465",  # RAN RAN Station — Biberach (86 km)
}

# Aalen city centre — used for distance/bearing calculations in the notebook
AALEN_CENTER = (48.8374, 10.0936)  # (lat, lon)


# ── Parallel raw-price loading ───────────────────────────────────────────────

def _read_price_file(
    path: Path,
    station_uuids: set,
    fuel_type: str,
) -> pd.DataFrame | None:
    """Read one daily CSV file and filter to the requested stations and fuel type."""
    try:
        df = pd.read_csv(
            path,
            usecols=["date", "station_uuid", fuel_type],
            dtype={"station_uuid": str, fuel_type: "float32"},
        )
        df = df[df["station_uuid"].isin(station_uuids)]
        return df if not df.empty else None
    except Exception:
        return None


def load_raw_prices_parallel(
    data_path: Path,
    station_uuids: set,
    fuel_type: str = "diesel",
    start_date: str | None = None,
    end_date: str | None = None,
    max_workers: int = 8,
) -> pd.DataFrame:
    """
    Parallel variant of load_raw_prices using ThreadPoolExecutor.

    Reads daily price CSVs concurrently (I/O-bound) with a tqdm progress bar.
    Only valid prices (> 0.5 €/L) are kept; results are sorted by date.
    """
    prices_root = data_path / "prices"
    all_files = sorted(prices_root.rglob("*-prices.csv"))

    # Determine date bounds
    ts_start = pd.Timestamp(start_date) if start_date else None
    if end_date:
        ts_end = pd.Timestamp(end_date) + pd.Timedelta(days=1) - pd.Timedelta(hours=1)
    else:
        ts_end = None

    # Pre-filter file list by date range (cheap — just parse filename)
    filtered: list[Path] = []
    for f in all_files:
        date_str = f.stem.replace("-prices", "")
        try:
            file_date = pd.Timestamp(date_str)
        except Exception:
            continue
        if ts_start and file_date < ts_start:
            continue
        if ts_end and file_date > ts_end:
            continue
        filtered.append(f)

    # Parallel reads
    chunks: list[pd.DataFrame] = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(_read_price_file, f, station_uuids, fuel_type): f
            for f in filtered
        }
        for fut in tqdm(
            as_completed(futures),
            total=len(filtered),
            desc="CSV-Dateien lesen",
            unit="Datei(en)",
        ):
            result = fut.result()
            if result is not None:
                chunks.append(result)

    if not chunks:
        raise ValueError(
            f"No price data found for stations under {prices_root}. "
            "Check TANKERKOENIG_DATA_PATH in .env."
        )

    raw = pd.concat(chunks, ignore_index=True)
    raw["date"] = pd.to_datetime(raw["date"], utc=True)
    raw = raw.dropna(subset=[fuel_type])
    raw = raw[raw[fuel_type] > 0.5]
    raw = raw.sort_values("date").reset_index(drop=True)
    return raw


# ── Aggregation ─────────────────────────────────────────────────────────────

def aggregate_hourly_per_station(
    df_raw: pd.DataFrame,
    station_uuids: dict[str, str],
    fuel_type: str = "diesel",
) -> pd.DataFrame:
    """
    Floor each price event to its hour bucket and pivot by station UUID.

    No averaging across stations — each station gets its own column.
    Sparse hours are forward-filled (carries the last posted price forward),
    which is semantically correct: "what would you pay at hour h?"

    Parameters
    ----------
    df_raw : pd.DataFrame
        Output of load_raw_prices_parallel() — columns: date, station_uuid, {fuel_type}
    station_uuids : dict[str, str]
        Mapping of route name → UUID (keys become column name suffixes)
    fuel_type : str

    Returns
    -------
    pd.DataFrame
        Hourly DataFrame indexed by Europe/Berlin naive timestamps.
        Columns: "{fuel_type}_{route_name}" for each entry in station_uuids.
    """
    uuid_to_name = {v: k for k, v in station_uuids.items()}

    df = df_raw.copy()
    df["ts"] = (
        df["date"]
        .dt.tz_convert("Europe/Berlin")
        .dt.tz_localize(None)
    )
    df["hour"] = df["ts"].dt.floor("h")
    df["route_name"] = df["station_uuid"].map(uuid_to_name)

    hourly = (
        df.groupby(["hour", "route_name"])[fuel_type]
        .mean()
        .unstack("route_name")
    )

    full_idx = pd.date_range(hourly.index.min(), hourly.index.max(), freq="h")
    hourly = hourly.reindex(full_idx)
    hourly = hourly.ffill()

    hourly.index.name = "timestamp"
    hourly.columns = [f"{fuel_type}_{c}" for c in hourly.columns]

    return hourly


# ── Feature engineering ─────────────────────────────────────────────────────

def build_features(
    df_hourly: pd.DataFrame,
    stride: int = 0,
    forecast_horizon: int = 72,
    fuel_type: str = "diesel",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build feature matrix X and multi-horizon target DataFrame y.

    Time-of-day and day-of-week are encoded cyclically (sin/cos) so the
    model sees hour 23 and hour 0 as neighbours, not opposites.

    Parameters
    ----------
    df_hourly : pd.DataFrame
        Wide hourly DataFrame with columns "{fuel_type}_{route_name}".
    stride : int
        Shifts the observation window into the past (0 = features known at t).
    forecast_horizon : int
        Predict t+1h … t+H for each station.
    fuel_type : str

    Returns
    -------
    X : pd.DataFrame  — feature columns
    y : pd.DataFrame  — target columns (5 stations × H horizons)
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    df = df_hourly.copy()

    for col in price_cols:
        s = df[col]

        for lag in LAG_HOURS:
            df[f"{col}_lag_{lag}h"] = s.shift(lag + stride)

        df[f"{col}_price_t"] = s.shift(stride)
        df[f"{col}_diff"]    = s.shift(stride) - s.shift(1 + stride)

        for w in ROLLING_WINDOWS:
            df[f"{col}_roll_mean_{w}h"] = s.shift(stride).rolling(w, min_periods=w).mean()
            df[f"{col}_roll_std_{w}h"]  = s.shift(stride).rolling(w, min_periods=w).std()

        df[f"{col}_trend"]    = _rolling_linear_slope(s.shift(stride), TREND_WINDOW)
        df[f"{col}_momentum"] = s.shift(1 + stride) - s.shift(24 + stride)

    # Cyclical time encoding — prevents the model from treating hour 23→0 as a large jump
    idx = df.index
    df["hour_sin"] = np.sin(2 * np.pi * idx.hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * idx.hour / 24)
    df["dow_sin"]  = np.sin(2 * np.pi * idx.dayofweek / 7)
    df["dow_cos"]  = np.cos(2 * np.pi * idx.dayofweek / 7)
    df["is_weekend"] = (idx.dayofweek >= 5).astype(np.int8)
    df["is_holiday"] = _is_holiday(idx).astype(np.int8)

    target_cols: list[str] = []
    for step in range(1, forecast_horizon + 1):
        for col in price_cols:
            tc = f"{col}_t+{step}h"
            df[tc] = df[col].shift(-step)
            target_cols.append(tc)

    df = df.iloc[WARMUP_ROWS:].copy()
    df = df.dropna(subset=target_cols)

    y = df[target_cols].copy()

    excluded = set(price_cols + target_cols)
    feature_cols = [c for c in df.columns if c not in excluded]
    X = df[feature_cols].copy()

    return X, y


# ── DataLoader ──────────────────────────────────────────────────────────────

class SpeditionDataLoader:
    """
    One-stop loader for the Spedition 5-station MLP pipeline.

    The train/val split boundaries are passed by the caller (single source
    of truth in the notebook) rather than hardcoded here.

    Caches the intermediate hourly parquet to data/processed/ so the
    raw CSV scan only runs once per configuration.

    Example
    -------
        loader = SpeditionDataLoader(
            train_end="2021-12-31 23:00",
            val_end="2023-12-31 23:00",
            forecast_horizon=72,
            fuel_type="diesel",
            debug=True,
        )
        X, y = loader.load()
        splits = loader.train_val_test_split(X, y)
    """

    def __init__(
        self,
        train_end: str = "2021-12-31 23:00",
        val_end:   str = "2023-12-31 23:00",
        station_uuids: dict[str, str] | None = None,
        stride: int = 0,
        forecast_horizon: int = 72,
        fuel_type: str = "diesel",
        cache: bool = True,
        debug: bool = False,
        start_date: str | None = None,
        end_date: str | None = None,
    ):
        self.train_end     = train_end
        self.val_end       = val_end
        self.station_uuids = station_uuids or SPEDITION_STATIONS
        self.stride        = stride
        self.forecast_horizon = forecast_horizon
        self.fuel_type     = fuel_type
        self.cache         = cache
        self.debug         = debug
        self.start_date    = start_date
        self.end_date      = end_date

        self._cfg = load_config()

    @property
    def _cache_path(self) -> Path:
        start_key = (self.start_date or "all").replace(":", "-").replace(" ", "T")
        end_key   = (self.end_date   or "all").replace(":", "-").replace(" ", "T")
        return (
            self._cfg["processed_dir"]
            / f"spedition_5stations_{self.fuel_type}_{start_key}_{end_key}.parquet"
        )

    def _validate_station_uuids(self) -> None:
        unset = [name for name, uid in self.station_uuids.items() if uid == "TO_BE_SET"]
        if unset:
            raise ValueError(
                f"Station UUIDs not yet set for: {unset}. "
                "Run the Station Discovery section in spedition_mlp.ipynb first, "
                "then update SPEDITION_STATIONS in data_transform_spedition.py."
            )

    def load(self, refresh: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Return (X, y) feature matrices.

        Skips the 87 GB raw CSV scan if a cached parquet already exists.
        Raw CSV reading uses parallel ThreadPoolExecutor for speed.
        """
        self._validate_station_uuids()

        if self.cache and self._cache_path.exists() and not refresh:
            if self.debug:
                print(f"[SpeditionDataLoader] Loading from cache: {self._cache_path}")
            df_hourly = pd.read_parquet(self._cache_path)
        else:
            uuids = set(self.station_uuids.values())
            if self.debug:
                print(f"[SpeditionDataLoader] Loading raw prices for {len(uuids)} stations …")

            df_raw = load_raw_prices_parallel(
                self._cfg["data_path"],
                uuids,
                self.fuel_type,
                self.start_date,
                self.end_date,
            )
            if self.debug:
                print(f"  {len(df_raw):,} price events loaded")
                print("[SpeditionDataLoader] Aggregating to per-station hourly series …")

            df_hourly = aggregate_hourly_per_station(df_raw, self.station_uuids, self.fuel_type)
            if self.debug:
                print(
                    f"  Hourly shape: {df_hourly.shape}  "
                    f"({df_hourly.index.min()} → {df_hourly.index.max()})"
                )

            if self.cache:
                df_hourly.to_parquet(self._cache_path)
                print(f"  Cached to: {self._cache_path}")

        if self.debug:
            print("[SpeditionDataLoader] Building feature matrix …")
        X, y = build_features(df_hourly, self.stride, self.forecast_horizon, self.fuel_type)
        if self.debug:
            print(f"[SpeditionDataLoader] Feature matrix ready: X={X.shape}, y={y.shape}")
        return X, y

    def train_val_test_split(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame,
               pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Temporal split (no shuffle) using the boundaries set in the constructor:
          train : start → train_end
          val   : train_end+1h → val_end
          test  : val_end+1h  → present
        """
        train_end = min(pd.Timestamp(self.train_end), X.index.max())
        val_end   = min(pd.Timestamp(self.val_end),   X.index.max())

        X_train = X.loc[:train_end]
        y_train = y.loc[:train_end]

        X_val = X.loc[train_end:val_end].iloc[1:] if train_end < val_end else X.iloc[0:0]
        y_val = y.loc[train_end:val_end].iloc[1:] if train_end < val_end else y.iloc[0:0]

        X_test = X.loc[val_end:].iloc[1:] if val_end < X.index.max() else X.iloc[0:0]
        y_test = y.loc[val_end:].iloc[1:] if val_end < y.index.max() else y.iloc[0:0]

        def _fmt(df: pd.DataFrame) -> str:
            return "empty" if df.empty else f"{df.index[0]}  →  {df.index[-1]}"

        print(f"  Train : {_fmt(X_train)}  ({len(X_train):,} rows)")
        print(f"  Val   : {_fmt(X_val)}  ({len(X_val):,} rows)")
        print(f"  Test  : {_fmt(X_test)}  ({len(X_test):,} rows)")

        return X_train, X_val, X_test, y_train, y_val, y_test


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Spedition Data Loader — build or refresh hourly per-station cache"
    )
    parser.add_argument("--refresh",   action="store_true",
                        help="Rebuild parquet cache from raw CSVs even if it already exists")
    parser.add_argument("--debug",     action="store_true",
                        help="Enable verbose debug output")
    parser.add_argument("--train-end", default="2021-12-31 23:00", metavar="DATETIME")
    parser.add_argument("--val-end",   default="2023-12-31 23:00", metavar="DATETIME")
    parser.add_argument("--start",     default=None, metavar="YYYY-MM-DD")
    parser.add_argument("--end",       default=None, metavar="YYYY-MM-DD")
    args = parser.parse_args()

    loader = SpeditionDataLoader(
        train_end=args.train_end,
        val_end=args.val_end,
        forecast_horizon=72,
        fuel_type="diesel",
        cache=True,
        debug=args.debug,
        start_date=args.start,
        end_date=args.end,
    )
    X, y = loader.load(refresh=args.refresh)
    loader.train_val_test_split(X, y)

    if args.debug:
        print("\nFeature columns:")
        for col in X.columns:
            print(f"  {col}")
