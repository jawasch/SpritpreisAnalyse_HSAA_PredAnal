"""
Spedition Data Loader — 5-Station MLP feature pipeline.

Operates on 5 individual gas stations (one per route sector, ~25–30 km from Aalen)
instead of geographic cluster averages. Station UUIDs are discovered interactively
in notebooks/spedition_mlp.ipynb (Phase 2) and hardcoded in STATION_UUIDS below.

Usage
-----
    from scripts.data_transform_spedition import SpeditionDataLoader

    loader = SpeditionDataLoader(forecast_horizon=72, fuel_type="diesel", debug=True)
    X, y  = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)

CLI
---
    python scripts/data_transform_spedition.py [--refresh] [--debug] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
"""

import os
from pathlib import Path

import numpy as np
import pandas as pd

from scripts.data_transform import (
    load_config,
    load_raw_prices,
    _rolling_linear_slope,
    _is_holiday,
    LAG_HOURS,
    ROLLING_WINDOWS,
    TREND_WINDOW,
    WARMUP_ROWS,
)

DEBUG = os.getenv("DEBUG", False)

AALEN_CENTER = (48.8374, 10.0936)


class SpeditionDataLoader:
    """
    One-stop loader for the 5-station Spedition MLP pipeline.

    Station UUIDs are discovered in Phase 2 of notebooks/spedition_mlp.ipynb
    (Haversine filter + sector selection) and hardcoded in STATION_UUIDS.

    Caches the intermediate hourly parquet to data/processed/ so the
    87 GB raw CSV scan runs at most once.

    Example
    -------
        loader = SpeditionDataLoader(forecast_horizon=72, fuel_type="diesel", debug=True)
        X, y = loader.load()
        X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
    """

    # Filled in after Phase 2 notebook discovery (station name → UUID)
    STATION_UUIDS: dict[str, str] = {
        # "ARAL Ellwangen":         "uuid-here",
        # "Shell Heidenheim":       "uuid-here",
        # "Jet Schwäbisch Gmünd":   "uuid-here",
        # "Total Schorndorf":       "uuid-here",
        # "Esso Welzheim":          "uuid-here",
    }

    _TRAIN_END = "2021-12-31 23:00"
    _VAL_END   = "2023-12-31 23:00"

    def __init__(
        self,
        forecast_horizon: int = 72,
        fuel_type: str = "diesel",
        cache: bool = True,
        debug: bool = False,
        start_date: str | None = None,
        end_date: str | None = None,
        station_uuids: dict[str, str] | None = None,
    ):
        self.forecast_horizon = forecast_horizon
        self.fuel_type = fuel_type
        self.cache = cache
        self.debug = debug
        self.start_date = start_date
        self.end_date = end_date

        # Allow runtime override (e.g. from notebook experimentation)
        self.station_uuids = station_uuids if station_uuids is not None else self.STATION_UUIDS

        global DEBUG
        DEBUG = debug

        self._cfg = load_config()

    @property
    def cache_path(self) -> Path:
        return self._cfg["processed_dir"] / "spedition_5stations_diesel.parquet"

    # ── Aggregation ─────────────────────────────────────────────────────────

    @staticmethod
    def aggregate_hourly_per_station(
        df_raw: pd.DataFrame,
        station_uuids: dict[str, str],
        fuel_type: str = "diesel",
    ) -> pd.DataFrame:
        """
        Floor price-change events to hour → pivot by station_uuid → ffill.

        Returns DataFrame with columns "{fuel_type}_{station_name}" for each
        station, indexed by Europe/Berlin hourly timestamp (tz-naive).
        """
        uuid_to_name = {v: k for k, v in station_uuids.items()}

        df = df_raw.copy()
        df["ts"] = (
            df["date"]
            .dt.tz_convert("Europe/Berlin")
            .dt.tz_localize(None)
        )
        df["hour"] = df["ts"].dt.floor("h")

        hourly = (
            df.groupby(["hour", "station_uuid"])[fuel_type]
            .mean()
            .unstack("station_uuid")
        )

        full_idx = pd.date_range(hourly.index.min(), hourly.index.max(), freq="h")
        hourly = hourly.reindex(full_idx)
        hourly = hourly.ffill()

        hourly.index.name = "timestamp"
        hourly.columns = [f"{fuel_type}_{uuid_to_name.get(c, c)}" for c in hourly.columns]

        if DEBUG:
            nan_pct = hourly.isna().mean().mul(100).round(1)
            print(f"[DEBUG] NaN % per station after ffill: {nan_pct.to_dict()}")

        return hourly

    # ── Feature engineering ──────────────────────────────────────────────────

    def build_features(
        self,
        df_hourly: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Build feature matrix X and multi-horizon target DataFrame y.

        Per station (5 stations):
          9 lags × 5          =  45 columns
          price_t × 5         =   5 columns
          roll mean/std × 5   =  30 columns  (3 windows × 2 stats × 5)
          diff + momentum × 5 =  10 columns
          trend × 5           =   5 columns
        Temporal features     =   4 columns
        Total                 =  ~99 feature columns

        Targets: 5 stations × 72 horizons = 360 columns
        """
        price_cols = [c for c in df_hourly.columns if c.startswith(f"{self.fuel_type}_")]
        df = df_hourly.copy()

        for col in price_cols:
            s = df[col]

            for lag in LAG_HOURS:
                df[f"{col}_lag_{lag}h"] = s.shift(lag)

            df[f"{col}_price_t"]  = s
            df[f"{col}_diff"]     = s - s.shift(1)

            for w in ROLLING_WINDOWS:
                df[f"{col}_roll_mean_{w}h"] = s.rolling(w, min_periods=w).mean()
                df[f"{col}_roll_std_{w}h"]  = s.rolling(w, min_periods=w).std()

            df[f"{col}_trend"]    = _rolling_linear_slope(s, TREND_WINDOW)
            df[f"{col}_momentum"] = s.shift(1) - s.shift(24)

        idx = df.index
        df["hour"]        = idx.hour
        df["day_of_week"] = idx.dayofweek
        df["is_weekend"]  = (idx.dayofweek >= 5).astype(np.int8)
        df["is_holiday"]  = _is_holiday(idx).astype(np.int8)

        target_cols: list[str] = []
        for step in range(1, self.forecast_horizon + 1):
            for col in price_cols:
                target_col = f"{col}_t+{step}h"
                df[target_col] = df[col].shift(-step)
                target_cols.append(target_col)

        df = df.iloc[WARMUP_ROWS:].copy()
        df = df.dropna(subset=target_cols)

        y = df[target_cols].copy()
        excluded_cols = set(price_cols + target_cols)
        X = df[[c for c in df.columns if c not in excluded_cols]].copy()

        return X, y

    # ── Main load ────────────────────────────────────────────────────────────

    def load(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        refresh: bool = False,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Return (X, y). Uses parquet cache unless refresh=True."""
        if not self.station_uuids:
            raise ValueError(
                "station_uuids is empty. Run Phase 2 of notebooks/spedition_mlp.ipynb "
                "to discover stations, then pass station_uuids= or fill STATION_UUIDS."
            )

        if DEBUG:
            print("[SpeditionDataLoader] DEBUG mode enabled")
            print(f"  Stations: {list(self.station_uuids.keys())}")

        start_date_eff = start_date or self.start_date
        end_date_eff   = end_date   or self.end_date

        if self.cache and self.cache_path.exists() and not refresh:
            print(f"[SpeditionDataLoader] Loading from cache: {self.cache_path}")
            df_hourly = pd.read_parquet(self.cache_path)
        else:
            uuids = set(self.station_uuids.values())
            if DEBUG:
                print(f"[SpeditionDataLoader] Loading raw prices for {len(uuids)} stations …")

            df_raw = load_raw_prices(
                self._cfg["data_path"], uuids, self.fuel_type,
                start_date_eff, end_date_eff,
            )

            if DEBUG:
                uuid_to_name = {v: k for k, v in self.station_uuids.items()}
                counts = df_raw.groupby("station_uuid").size()
                print("  Price events per station:")
                for uuid, n in counts.items():
                    name = uuid_to_name.get(uuid, uuid[:8])
                    print(f"    {name:30s}: {n:,}")

            df_hourly = self.aggregate_hourly_per_station(
                df_raw, self.station_uuids, self.fuel_type
            )

            if DEBUG:
                print(f"  Hourly shape: {df_hourly.shape}  "
                      f"({df_hourly.index.min()} → {df_hourly.index.max()})")

            if self.cache:
                df_hourly.to_parquet(self.cache_path)
                print(f"  Cached to: {self.cache_path}")

        X, y = self.build_features(df_hourly)

        if DEBUG:
            print(f"[SpeditionDataLoader] Feature matrix ready: X={X.shape}, y={y.shape}")

        return X, y

    # ── Temporal split ───────────────────────────────────────────────────────

    def train_val_test_split(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame,
               pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Temporal split (no shuffle):
          train : 2014-06 → 2021-12
          val   : 2022-01 → 2023-12
          test  : 2024-01 → present
        """
        train_end = min(pd.Timestamp(self._TRAIN_END), X.index.max())
        val_end   = min(pd.Timestamp(self._VAL_END),   X.index.max())

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
    parser.add_argument("--refresh", action="store_true",
                        help="Rebuild parquet cache from raw CSVs even if it already exists")
    parser.add_argument("--fuel-type", default="diesel", choices=["diesel", "e5", "e10"])
    parser.add_argument("--start", default=None, metavar="YYYY-MM-DD")
    parser.add_argument("--end",   default=None, metavar="YYYY-MM-DD")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    loader = SpeditionDataLoader(
        fuel_type=args.fuel_type,
        cache=True,
        debug=args.debug,
    )
    X, y = loader.load(start_date=args.start, end_date=args.end, refresh=args.refresh)
    loader.train_val_test_split(X, y)

    if args.debug:
        print("\nFeature columns:")
        for col in X.columns:
            print(f"  {col}")
