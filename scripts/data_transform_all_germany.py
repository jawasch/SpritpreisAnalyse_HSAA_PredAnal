"""
All-Germany Price Data Loader — Geographic Grid Aggregation.

Divides Germany (~47°N–55°N, 6°E–15°E) into a 10×9 = 90 geographic grid cells.
For each cell, aggregates all station prices to hourly means for three fuel types.

This creates a panel dataset suitable for training a national web forecast model
that supports all fuel types (diesel, e5, e10).

Usage
-----
    from scripts.data_transform_all_germany import AllGermanyDataLoader

    loader = AllGermanyDataLoader(fuel_types=['diesel', 'e5', 'e10'], debug=True)
    X, y = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)

CLI
---
    python scripts/data_transform_all_germany.py [--refresh] [--fuel-types diesel,e5,e10]
"""

import os
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from dotenv import load_dotenv

# ── Import shared helpers and constants from existing pipeline ─────────────────
from scripts.data_transform import (
    LAG_HOURS,
    ROLLING_WINDOWS,
    TREND_WINDOW,
    WARMUP_ROWS,
    _is_holiday,
    _rolling_linear_slope,
    load_config,
)

# ── Germany bounding box and grid definition ───────────────────────────────────
GRID_LAT_START = 47.0   # southernmost latitude
GRID_LAT_STEP  = 0.8    # cell height in degrees (~89 km)
GRID_ROWS      = 10     # 47.0 → 55.0 N

GRID_LON_START = 6.0    # westernmost longitude
GRID_LON_STEP  = 1.0    # cell width in degrees (~70 km at 50°N)
GRID_COLS      = 9      # 6.0 → 15.0 E

FUEL_TYPES_ALL = ["diesel", "e5", "e10"]

# Training / validation / test split boundaries (same as B29 and Spedition)
TRAIN_END = "2021-12-31"
VAL_END   = "2023-12-31"


def _cell_id(row: int, col: int) -> str:
    """Return human-readable cell identifier, e.g. 'cell_03_05'."""
    return f"cell_{row:02d}_{col:02d}"


def _cell_centroid(row: int, col: int) -> tuple[float, float]:
    """Return (lat, lon) centroid for a grid cell."""
    lat = GRID_LAT_START + (row + 0.5) * GRID_LAT_STEP
    lon = GRID_LON_START + (col + 0.5) * GRID_LON_STEP
    return round(lat, 4), round(lon, 4)


def assign_grid_cell(lat: float, lon: float) -> str | None:
    """
    Assign a station to a grid cell ID based on its coordinates.
    Returns None for stations outside the Germany bounding box.
    """
    row = int((lat - GRID_LAT_START) / GRID_LAT_STEP)
    col = int((lon - GRID_LON_START) / GRID_LON_STEP)
    if 0 <= row < GRID_ROWS and 0 <= col < GRID_COLS:
        return _cell_id(row, col)
    return None


def get_grid_metadata() -> pd.DataFrame:
    """
    Return a DataFrame with all grid cell IDs, centroids, and row/col indices.
    Useful for visualising the grid on a map.
    """
    rows = []
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            lat, lon = _cell_centroid(r, c)
            rows.append({
                "cell_id": _cell_id(r, c),
                "row": r,
                "col": c,
                "lat": lat,
                "lon": lon,
                "lat_min": GRID_LAT_START + r * GRID_LAT_STEP,
                "lat_max": GRID_LAT_START + (r + 1) * GRID_LAT_STEP,
                "lon_min": GRID_LON_START + c * GRID_LON_STEP,
                "lon_max": GRID_LON_START + (c + 1) * GRID_LON_STEP,
            })
    return pd.DataFrame(rows)


def _read_price_file(path: Path, station_uuids: set[str]) -> pd.DataFrame | None:
    """Load a single daily CSV and filter to the provided station UUIDs."""
    try:
        df = pd.read_csv(path, usecols=["date", "station_uuid", "diesel", "e5", "e10"])
        df = df[df["station_uuid"].isin(station_uuids)]
        if df.empty:
            return None
        df["date"] = pd.to_datetime(df["date"], utc=True)
        for col in ["diesel", "e5", "e10"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            # Remove outliers (prices outside realistic EUR/L range for Germany)
            df.loc[(df[col] < 0.5) | (df[col] > 4.0), col] = np.nan
        return df
    except Exception:
        return None


def load_and_aggregate_grid(
    data_path: Path,
    station_cells: pd.DataFrame,
    fuel_types: list[str],
    start_date: str | None = None,
    end_date: str | None = None,
    debug: bool = False,
) -> pd.DataFrame:
    """
    Load all daily price CSVs in parallel, assign stations to grid cells,
    and aggregate to hourly means per cell per fuel type.

    Parameters
    ----------
    data_path : Path
        Root of the Tankerkönig raw data directory.
    station_cells : pd.DataFrame
        Columns: station_uuid, cell_id — pre-computed station→cell mapping.
    fuel_types : list[str]
        Subset of ["diesel", "e5", "e10"] to include.
    start_date, end_date : str | None
        ISO date strings to filter the CSV files loaded.

    Returns
    -------
    pd.DataFrame
        Wide hourly DataFrame with columns like 'diesel_cell_03_05'.
        DatetimeIndex (UTC, then tz-naive).
    """
    prices_dir = data_path / "prices"
    all_csv = sorted(prices_dir.rglob("*.csv"))

    if start_date:
        start_ts = pd.Timestamp(start_date)
        all_csv = [p for p in all_csv if pd.Timestamp(p.stem.split("-prices")[0]) >= start_ts]
    if end_date:
        end_ts = pd.Timestamp(end_date) + pd.Timedelta(days=1)
        all_csv = [p for p in all_csv if pd.Timestamp(p.stem.split("-prices")[0]) < end_ts]

    if debug:
        print(f"[AllGermany] Loading {len(all_csv)} CSV files …")

    valid_uuids = set(station_cells["station_uuid"].values)

    chunks = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_read_price_file, p, valid_uuids): p for p in all_csv}
        for i, fut in enumerate(as_completed(futures)):
            result = fut.result()
            if result is not None:
                chunks.append(result)
            if debug and i % 200 == 0:
                print(f"  {i}/{len(all_csv)} files processed …")

    if not chunks:
        raise ValueError("No valid price data loaded. Check data_path and station UUIDs.")

    raw = pd.concat(chunks, ignore_index=True)

    # Map station UUID → cell_id
    uuid_to_cell = station_cells.set_index("station_uuid")["cell_id"].to_dict()
    raw["cell_id"] = raw["station_uuid"].map(uuid_to_cell)
    raw = raw.dropna(subset=["cell_id"])

    # Aggregate to hourly means per cell per fuel type
    raw["hour"] = raw["date"].dt.floor("H")
    groups = raw.groupby(["hour", "cell_id"])[fuel_types].mean()

    # Pivot to wide format: columns = {fuel_type}_{cell_id}
    wide = groups.unstack("cell_id")
    wide.columns = [f"{ft}_{cell}" for ft, cell in wide.columns]
    wide.index = wide.index.tz_localize(None)  # remove UTC tz for sklearn compatibility
    wide = wide.sort_index()

    if debug:
        print(f"[AllGermany] Wide DataFrame: {wide.shape}, "
              f"last={wide.index[-1]}, columns={len(wide.columns)}")

    return wide


def build_features_all_germany(
    df_hourly: pd.DataFrame,
    fuel_types: list[str],
    forecast_horizon: int = 72,
    stride: int = 0,
    single_fuel: str | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build feature matrix X and multi-step target DataFrame y.
    Reuses the same lag/rolling/trend/temporal feature pattern as
    data_transform.py → build_features().

    Parameters
    ----------
    df_hourly : pd.DataFrame
        Wide hourly DataFrame with columns '{fuel_type}_{location}'.
    fuel_types : list[str]
        All fuel types present in df_hourly.
    forecast_horizon : int
        Predict t+1h … t+H for each location×fuel combination.
    single_fuel : str | None
        If set, build features for ALL fuel types (for richer context) but
        produce TARGET columns only for this one fuel type.
        This reduces peak RAM by ~3× when training models sequentially.

    Returns
    -------
    X : pd.DataFrame  — feature columns (all fuels as predictors)
    y : pd.DataFrame  — target columns for `single_fuel` (or all fuels if None)
    """
    # Features use ALL fuel types as predictors (cross-fuel context)
    all_price_cols = [
        c for c in df_hourly.columns
        if any(c.startswith(f"{ft}_") for ft in fuel_types)
    ]
    # Targets only for the requested fuel (or all)
    target_fuel = single_fuel or "_ALL_"
    target_price_cols = [
        c for c in all_price_cols
        if single_fuel is None or c.startswith(f"{single_fuel}_")
    ]

    # Build feature dict (avoids DataFrame fragmentation)
    feat: dict[str, pd.Series] = {}
    for col in all_price_cols:
        s = df_hourly[col]
        for lag in LAG_HOURS:
            feat[f"{col}_lag_{lag}h"] = s.shift(lag + stride)
        feat[f"{col}_price_t"] = s.shift(stride)
        feat[f"{col}_diff"]    = s.shift(stride) - s.shift(1 + stride)
        for w in ROLLING_WINDOWS:
            feat[f"{col}_roll_mean_{w}h"] = s.shift(stride).rolling(w, min_periods=w).mean()
            feat[f"{col}_roll_std_{w}h"]  = s.shift(stride).rolling(w, min_periods=w).std()
        feat[f"{col}_trend"]    = _rolling_linear_slope(s.shift(stride), TREND_WINDOW)
        feat[f"{col}_momentum"] = s.shift(1 + stride) - s.shift(24 + stride)

    idx = df_hourly.index
    feat["hour_sin"]   = pd.Series(np.sin(2 * np.pi * idx.hour / 24),    index=idx)
    feat["hour_cos"]   = pd.Series(np.cos(2 * np.pi * idx.hour / 24),    index=idx)
    feat["dow_sin"]    = pd.Series(np.sin(2 * np.pi * idx.dayofweek / 7), index=idx)
    feat["dow_cos"]    = pd.Series(np.cos(2 * np.pi * idx.dayofweek / 7), index=idx)
    feat["is_weekend"] = pd.Series((idx.dayofweek >= 5).astype(np.int8),  index=idx)
    feat["is_holiday"] = _is_holiday(idx).astype(np.int8)

    # Target columns (only for single_fuel if specified)
    tgt: dict[str, pd.Series] = {}
    for step in range(1, forecast_horizon + 1):
        for col in target_price_cols:
            tgt[f"{col}_t+{step}h"] = df_hourly[col].shift(-step)

    X_raw = pd.DataFrame(feat, index=idx)
    y_raw = pd.DataFrame(tgt, index=idx)

    # Drop warmup rows and rows where any target is NaN
    valid = X_raw.iloc[WARMUP_ROWS:].copy()
    valid_y = y_raw.iloc[WARMUP_ROWS:].copy()
    mask = valid_y.notna().all(axis=1)
    return valid[mask], valid_y[mask]


def load_from_existing_parquets(
    processed_dir: Path,
    fuel_types: list[str] | None = None,
    debug: bool = False,
) -> pd.DataFrame:
    """
    Build a wide hourly DataFrame from already-processed parquets —
    no raw-CSV scan required.

    Uses:
      - b29_hourly_diesel_all_all.parquet   (4 B29 clusters, diesel 2014–2026)
      - spedition_5stations_diesel_all_all.parquet  (5 route stations, diesel)

    For E5 and E10, diesel prices are scaled by historical ratios
    (E5 ≈ diesel × 1.062, E10 ≈ diesel × 1.037).

    Returns a wide DataFrame whose columns are '{fuel_type}_{location}'
    ready to be fed into build_features_all_germany().
    """
    if fuel_types is None:
        fuel_types = FUEL_TYPES_ALL

    _RATIO = {"diesel": 1.0, "e5": 1.062, "e10": 1.037}

    frames: list[pd.DataFrame] = []

    # ── B29 corridor (4 clusters) ───────────────────────────────────────────
    b29_path = processed_dir / "b29_hourly_diesel_all_all.parquet"
    if b29_path.exists():
        b29 = pd.read_parquet(b29_path)
        for ft in fuel_types:
            ratio = _RATIO[ft]
            for col in b29.columns:
                # col e.g. "diesel_Aalen" → rename to "{ft}_{col_without_fuel}"
                location = col.replace("diesel_", "")
                safe_loc = location.replace(" ", "_").replace("ä", "ae").replace("ü", "ue").replace("ö", "oe")
                frames.append((b29[col] * ratio).rename(f"{ft}_{safe_loc}"))
        if debug:
            print(f"[quick_load] B29 parquet: {b29.shape}, last={b29.index[-1]}")
    else:
        raise FileNotFoundError(f"Missing: {b29_path}")

    # ── Spedition 5 stations ────────────────────────────────────────────────
    sp_path = processed_dir / "spedition_5stations_diesel_all_all.parquet"
    if sp_path.exists():
        sp = pd.read_parquet(sp_path)
        for ft in fuel_types:
            ratio = _RATIO[ft]
            for col in sp.columns:
                location = col.replace("diesel_", "")
                frames.append((sp[col] * ratio).rename(f"{ft}_{location}"))
        if debug:
            print(f"[quick_load] Spedition parquet: {sp.shape}, last={sp.index[-1]}")
    else:
        if debug:
            print(f"[quick_load] Spedition parquet not found, skipping.")

    # Align all series on a common hourly index (inner join removes gaps)
    df = pd.concat(frames, axis=1).sort_index()
    df = df[~df.index.duplicated(keep="last")]

    if debug:
        print(f"[quick_load] Combined DataFrame: {df.shape}, "
              f"{df.index.min().date()} → {df.index.max().date()}")

    return df


class AllGermanyDataLoader:
    """
    One-stop loader for the All-Germany MLP pipeline.

    Caches the aggregated hourly parquet to data/processed/ so the
    full CSV scan (87 GB) runs at most once.

    **quick_mode=True** (default) uses only the already-processed
    parquet files (B29 + Spedition, ~4 MB total) — no raw-CSV scan,
    no RAM spike.  Set quick_mode=False to build the full 90-cell
    national dataset from raw CSVs (requires ~4 GB RAM peak).

    Example
    -------
        loader = AllGermanyDataLoader(
            fuel_types=['diesel', 'e5', 'e10'],
            forecast_horizon=72,
            quick_mode=True,   # use existing parquets — no CSV scan
            debug=True
        )
        X, y = loader.load()
        X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
    """

    def __init__(
        self,
        fuel_types: list[str] | None = None,
        forecast_horizon: int = 72,
        train_end: str = TRAIN_END,
        val_end: str = VAL_END,
        debug: bool = False,
        min_stations_per_cell: int = 3,
        quick_mode: bool = True,
    ):
        self.fuel_types = fuel_types or FUEL_TYPES_ALL
        self.forecast_horizon = forecast_horizon
        self.train_end = train_end
        self.val_end = val_end
        self.debug = debug
        self.min_stations_per_cell = min_stations_per_cell
        self.quick_mode = quick_mode

        config = load_config()
        self.data_path = config["data_path"]
        self.processed_dir = config["processed_dir"]

    @property
    def _cache_path(self) -> Path:
        fuels = "_".join(sorted(self.fuel_types))
        return self.processed_dir / f"all_germany_grid_{fuels}.parquet"

    def _build_station_cell_mapping(self) -> pd.DataFrame:
        """
        Read stations_geo.parquet and assign each station to a grid cell.
        Filters out cells with fewer than min_stations_per_cell stations.
        """
        geo_path = self.processed_dir / "stations_geo.parquet"
        if not geo_path.exists():
            raise FileNotFoundError(f"stations_geo.parquet not found at {geo_path}")

        geo = pd.read_parquet(geo_path, columns=["uuid", "latitude", "longitude"])
        geo = geo.dropna(subset=["latitude", "longitude"])
        geo["cell_id"] = geo.apply(
            lambda r: assign_grid_cell(r["latitude"], r["longitude"]), axis=1
        )
        geo = geo.dropna(subset=["cell_id"])

        # Filter to cells with enough stations
        cell_counts = geo["cell_id"].value_counts()
        valid_cells = cell_counts[cell_counts >= self.min_stations_per_cell].index
        geo = geo[geo["cell_id"].isin(valid_cells)]

        if self.debug:
            print(f"[AllGermany] Station→Cell mapping: {len(geo)} stations, "
                  f"{geo['cell_id'].nunique()} active cells")

        return geo[["uuid", "cell_id"]].rename(columns={"uuid": "station_uuid"})

    def load(
        self,
        refresh: bool = False,
        single_fuel: str | None = None,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Load or build the All-Germany feature matrix.

        quick_mode=True  (default) — uses only the already-processed parquets
                          (b29 + spedition, ~4 MB total, < 60 s, safe RAM).
        quick_mode=False — full 87 GB CSV scan; only use if the raw data is
                          available and you have ≥ 8 GB free RAM.
        refresh=True     — force rebuild even if a cache parquet exists.
        single_fuel      — if set, target columns only for this fuel type.
                          Use in a per-fuel-type loop to reduce peak RAM ~3×.
                          Example: loader.load(single_fuel='diesel')
        """
        if self.quick_mode:
            if self.debug:
                print("[AllGermany] quick_mode=True — using existing processed parquets "
                      "(no raw-CSV scan). Pass quick_mode=False for the full 90-cell dataset.")
            df_hourly = load_from_existing_parquets(
                self.processed_dir,
                fuel_types=self.fuel_types,
                debug=self.debug,
            )
        elif self._cache_path.exists() and not refresh:
            if self.debug:
                print(f"[AllGermany] Loading from cache: {self._cache_path}")
            df_hourly = pd.read_parquet(self._cache_path)
        else:
            if self.debug:
                print("[AllGermany] Building from raw CSVs — this may take 10-30 minutes "
                      "and requires ~4-8 GB free RAM …")
            station_cells = self._build_station_cell_mapping()
            df_hourly = load_and_aggregate_grid(
                self.data_path,
                station_cells,
                self.fuel_types,
                debug=self.debug,
            )
            df_hourly.to_parquet(self._cache_path)
            if self.debug:
                print(f"[AllGermany] Cached to {self._cache_path}")

        return build_features_all_germany(
            df_hourly,
            self.fuel_types,
            self.forecast_horizon,
            single_fuel=single_fuel,
        )

    def train_val_test_split(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
    ) -> tuple[pd.DataFrame, ...]:
        """
        Temporal split (no shuffle):
            Train:      start → TRAIN_END (2021-12-31)
            Validation: TRAIN_END+1 → VAL_END (2023-12-31)
            Test:       VAL_END+1   → end
        """
        train_mask = X.index <= self.train_end
        val_mask   = (X.index > self.train_end) & (X.index <= self.val_end)
        test_mask  = X.index > self.val_end

        X_train, y_train = X[train_mask],  y[train_mask]
        X_val,   y_val   = X[val_mask],    y[val_mask]
        X_test,  y_test  = X[test_mask],   y[test_mask]

        if self.debug:
            for split, Xs in [("Train", X_train), ("Val", X_val), ("Test", X_test)]:
                print(f"  {split:6s}: {len(Xs):7,d} rows  "
                      f"({Xs.index.min().date()} → {Xs.index.max().date()})")

        return X_train, X_val, X_test, y_train, y_val, y_test


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build All-Germany grid parquet from raw CSVs")
    parser.add_argument("--refresh", action="store_true", help="Force rebuild even if cache exists")
    parser.add_argument("--fuel-types", default="diesel,e5,e10",
                        help="Comma-separated list: diesel,e5,e10")
    args = parser.parse_args()

    fuel_types = [f.strip() for f in args.fuel_types.split(",")]
    loader = AllGermanyDataLoader(fuel_types=fuel_types, debug=True)
    X, y = loader.load(refresh=args.refresh)
    print(f"\nFinal feature matrix: X={X.shape}, y={y.shape}")
    print(f"Feature columns (first 10): {list(X.columns[:10])}")
    print(f"Target columns  (first 3):  {list(y.columns[:3])}")
