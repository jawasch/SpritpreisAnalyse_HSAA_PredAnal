"""
Geo-enriched all-stations Data Loader for MLP panel regression.

Unlike B29DataLoader (cluster averages) and SpeditionDataLoader (5 fixed stations),
this loader treats every station as an independent entity and stacks them into a
single panel feature matrix where each row is one (timestamp, station) observation.

Static geo features — latitude, longitude, brand (target-mean-encoded), competition
density, and Autobahn flag — are appended to the per-station time-series features,
allowing a shared MLP to learn price patterns that generalise across stations.

Usage
-----
    from scripts.data_transform_geo import GeoDataLoader

    loader = GeoDataLoader(
        mode='bw',              # 'bw' = Baden-Württemberg only, 'full' = all Germany
        start_date='2022-01-01',
        forecast_horizon=72,
        fuel_type='diesel',
        debug=True,
    )
    X, y = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
    # Access brand encoding fitted on train set:
    print(loader.brand_mean_map)

CLI
---
    python scripts/data_transform_geo.py [--mode bw] [--start 2022-01-01] [--debug]
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd
from tqdm.auto import tqdm

from scripts.data_transform import (
    LAG_HOURS,
    ROLLING_WINDOWS,
    TREND_WINDOW,
    WARMUP_ROWS,
    _is_holiday,
    _rolling_linear_slope,
    load_config,
)
from scripts.geo_utils import compute_competition_density

# ── Constants ─────────────────────────────────────────────────────────────────

# PLZ prefixes that fall within Baden-Württemberg (7x and 8x)
_BW_PLZ_PREFIXES = ("7", "8")

# Stations with fewer than this many price events are excluded (inactive/data gaps)
_MIN_EVENTS = 100

# Autobahn name keywords (lowercase) for is_autobahn heuristic
_AUTOBAHN_KEYWORDS = [
    "bab", "autobahn", "tank & rast", "tank&rast", "raststätte",
    "rastanlage", "a 7", "a 8", "a 81", "a 6", "a 5", "a 8 ",
]


# ── Station loading & geo enrichment ──────────────────────────────────────────

def load_geo_stations(
    stations_geo_path: Path,
    mode: str = "bw",
) -> pd.DataFrame:
    """
    Load station metadata from stations_geo.parquet and optionally filter to BW.

    Parameters
    ----------
    stations_geo_path : Path   — path to data/processed/stations_geo.parquet
    mode              : str    — 'bw' (Baden-Württemberg) or 'full' (all Germany)

    Returns
    -------
    pd.DataFrame with columns: uuid, name, brand, post_code, latitude, longitude
    """
    df = pd.read_parquet(stations_geo_path)

    # Ensure post_code is a zero-padded string
    df["post_code"] = df["post_code"].astype(str).str.strip().str.zfill(5)

    if mode == "bw":
        mask = df["post_code"].str.startswith(_BW_PLZ_PREFIXES)
        df = df[mask].reset_index(drop=True)

    df = df.dropna(subset=["latitude", "longitude"]).reset_index(drop=True)

    keep = [c for c in ["uuid", "name", "brand", "post_code", "latitude", "longitude"]
            if c in df.columns]
    return df[keep].copy()


def enrich_station_features(df_stations: pd.DataFrame) -> pd.DataFrame:
    """
    Append static geo-derived features to the station metadata DataFrame.

    Added columns:
    - competitor_count_2km   : number of other stations within 2 km Haversine
    - nearest_competitor_km  : distance to nearest other station
    - is_autobahn            : 1 if the station name suggests Autobahn location

    Parameters
    ----------
    df_stations : pd.DataFrame — must contain uuid, latitude, longitude, (name)

    Returns
    -------
    Same DataFrame with additional columns merged in.
    """
    comp = compute_competition_density(df_stations, radius_km=2.0)
    df = df_stations.merge(comp, on="uuid", how="left")

    if "name" in df.columns:
        name_lower = df["name"].str.lower().fillna("")
        df["is_autobahn"] = name_lower.apply(
            lambda n: int(any(kw in n for kw in _AUTOBAHN_KEYWORDS))
        )
    else:
        df["is_autobahn"] = 0

    return df


# ── Parallel price loading ────────────────────────────────────────────────────

def _read_price_file(path: Path, station_uuids: set, fuel_type: str):
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
    """Parallel CSV scan reusing the pattern from data_transform_spedition.py."""
    prices_root = data_path / "prices"
    all_files = sorted(prices_root.rglob("*-prices.csv"))

    ts_start = pd.Timestamp(start_date) if start_date else None
    ts_end = (pd.Timestamp(end_date) + pd.Timedelta(days=1) - pd.Timedelta(hours=1)
              if end_date else None)

    filtered = []
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

    chunks = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(_read_price_file, f, station_uuids, fuel_type): f
                   for f in filtered}
        for fut in tqdm(as_completed(futures), total=len(filtered),
                        desc="CSV-Dateien lesen", unit="Datei"):
            result = fut.result()
            if result is not None:
                chunks.append(result)

    if not chunks:
        raise ValueError(f"No price data found under {prices_root}. "
                         "Check TANKERKOENIG_DATA_PATH in .env.")

    raw = pd.concat(chunks, ignore_index=True)
    raw["date"] = pd.to_datetime(raw["date"], utc=True)
    raw = raw.dropna(subset=[fuel_type])
    raw = raw[raw[fuel_type] > 0.5]
    return raw.sort_values("date").reset_index(drop=True)


# ── Per-station hourly aggregation ────────────────────────────────────────────

def aggregate_hourly_per_station(
    df_raw: pd.DataFrame,
    fuel_type: str = "diesel",
) -> pd.DataFrame:
    """
    Floor each price event to its hour bucket; one column per station UUID.

    Sparse hours are forward-filled (last known price). Returns a wide DataFrame
    indexed by Europe/Berlin naive timestamps.
    """
    df = df_raw.copy()
    df["ts"] = df["date"].dt.tz_convert("Europe/Berlin").dt.tz_localize(None)
    df["hour"] = df["ts"].dt.floor("h")

    hourly = (
        df.groupby(["hour", "station_uuid"])[fuel_type]
        .mean()
        .unstack("station_uuid")
    )

    full_idx = pd.date_range(hourly.index.min(), hourly.index.max(), freq="h")
    hourly = hourly.reindex(full_idx).ffill()
    hourly.index.name = "timestamp"
    return hourly


# ── Panel feature engineering ─────────────────────────────────────────────────

def build_panel_features(
    df_hourly: pd.DataFrame,
    df_stations: pd.DataFrame,
    fuel_type: str = "diesel",
    stride: int = 0,
    forecast_horizon: int = 72,
    brand_mean_map: dict | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build a stacked panel feature matrix — one row per (timestamp, station).

    For each station the following are assembled:
    - Time-series:  lags, rolling mean/std, trend slope, momentum (same as other loaders)
    - Temporal:     hour_sin/cos, dow_sin/cos, is_weekend, is_holiday
    - Static geo:   latitude, longitude, competitor_count_2km, nearest_competitor_km,
                    is_autobahn, brand_encoded (target mean from training set)

    Parameters
    ----------
    df_hourly      : wide hourly DataFrame; columns are station UUIDs
    df_stations    : station metadata with geo/competition columns (from enrich_station_features)
    brand_mean_map : {brand_str: mean_price} for target mean encoding (fitted on train only)

    Returns
    -------
    X : pd.DataFrame — (n_timestamps × n_stations, n_features), indexed by timestamp
    y : pd.DataFrame — same rows, columns = "t+1h" … "t+{H}h"
    """
    valid_uuids = set(df_stations["uuid"])
    station_uuids = [c for c in df_hourly.columns if c in valid_uuids]
    df_st = df_stations.set_index("uuid")

    all_X: list[pd.DataFrame] = []
    all_y: list[pd.DataFrame] = []

    for uuid in tqdm(station_uuids, desc="Panel-Features aufbauen", unit="Station"):
        s = df_hourly[uuid]
        df = pd.DataFrame(index=s.index)

        # Time-series features
        for lag in LAG_HOURS:
            df[f"lag_{lag}h"] = s.shift(lag + stride)

        df["price_t"]  = s.shift(stride)
        df["diff"]     = s.shift(stride) - s.shift(1 + stride)

        for w in ROLLING_WINDOWS:
            df[f"roll_mean_{w}h"] = s.shift(stride).rolling(w, min_periods=w).mean()
            df[f"roll_std_{w}h"]  = s.shift(stride).rolling(w, min_periods=w).std()

        df["trend"]    = _rolling_linear_slope(s.shift(stride), TREND_WINDOW)
        df["momentum"] = s.shift(1 + stride) - s.shift(24 + stride)

        # Temporal features (cyclical encoding)
        idx = df.index
        df["hour_sin"]   = np.sin(2 * np.pi * idx.hour / 24)
        df["hour_cos"]   = np.cos(2 * np.pi * idx.hour / 24)
        df["dow_sin"]    = np.sin(2 * np.pi * idx.dayofweek / 7)
        df["dow_cos"]    = np.cos(2 * np.pi * idx.dayofweek / 7)
        df["is_weekend"] = (idx.dayofweek >= 5).astype(np.int8)
        df["is_holiday"] = _is_holiday(idx).astype(np.int8)

        # Static geo features (broadcast over all timestamps)
        if uuid in df_st.index:
            st = df_st.loc[uuid]
            df["latitude"]              = float(st.get("latitude", np.nan))
            df["longitude"]             = float(st.get("longitude", np.nan))
            df["competitor_count_2km"]  = float(st.get("competitor_count_2km", 0))
            df["nearest_competitor_km"] = float(st.get("nearest_competitor_km", np.nan))
            df["is_autobahn"]           = int(st.get("is_autobahn", 0))
            brand = str(st.get("brand", "unknown") or "unknown")
            if brand_mean_map:
                df["brand_encoded"] = brand_mean_map.get(brand,
                                      brand_mean_map.get("__mean__", 0.0))
            else:
                df["brand_encoded"] = 0.0
        else:
            for col in ["latitude", "longitude", "competitor_count_2km",
                        "nearest_competitor_km", "is_autobahn", "brand_encoded"]:
                df[col] = 0.0

        df["station_uuid"] = uuid  # kept for post-hoc analysis (dropped before training)

        # Target columns
        target_cols = [f"t+{step}h" for step in range(1, forecast_horizon + 1)]
        for step, tc in enumerate(target_cols, start=1):
            df[tc] = s.shift(-step)

        # Drop warmup rows and any rows where targets are NaN (end of series)
        df = df.iloc[WARMUP_ROWS:].dropna(subset=target_cols)
        if df.empty:
            continue

        all_X.append(df.drop(columns=target_cols))
        all_y.append(df[target_cols])

    if not all_X:
        raise ValueError("No feature rows built. Check data range and station filters.")

    return pd.concat(all_X), pd.concat(all_y)


# ── GeoDataLoader ─────────────────────────────────────────────────────────────

class GeoDataLoader:
    """
    Panel data loader for geo-enriched all-stations MLP training.

    Stacks per-station feature rows (time-series + static geo) into a single
    feature matrix suitable for a shared MLP that generalises across stations.
    Brand target encoding is fitted on training rows only to prevent leakage.

    Example
    -------
        loader = GeoDataLoader(mode='bw', start_date='2022-01-01', debug=True)
        X, y = loader.load()
        X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
        print(loader.brand_mean_map)   # inspect brand encoding
    """

    _TRAIN_END = "2021-12-31 23:00"
    _VAL_END   = "2023-12-31 23:00"

    def __init__(
        self,
        mode: str = "bw",
        start_date: str | None = "2020-01-01",
        end_date: str | None = None,
        forecast_horizon: int = 72,
        fuel_type: str = "diesel",
        stride: int = 0,
        cache: bool = True,
        debug: bool = False,
    ):
        self.mode             = mode
        self.start_date       = start_date
        self.end_date         = end_date
        self.forecast_horizon = forecast_horizon
        self.fuel_type        = fuel_type
        self.stride           = stride
        self.cache            = cache
        self.debug            = debug
        self.brand_mean_map: dict | None = None  # populated after load()

        self._cfg = load_config()

    @property
    def _cache_path(self) -> Path:
        start_key = (self.start_date or "all").replace(":", "-").replace(" ", "T")
        end_key   = (self.end_date   or "all").replace(":", "-").replace(" ", "T")
        return (
            self._cfg["processed_dir"]
            / f"geo_{self.mode}_{self.fuel_type}_{start_key}_{end_key}.parquet"
        )

    def load(self, refresh: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Build and return (X, y) panel feature matrices.

        On first call this scans the raw CSVs and writes a per-station hourly
        parquet to data/processed/. Subsequent calls use that cache.
        Brand target encoding is fitted on training rows only.
        """
        stations_geo_path = self._cfg["processed_dir"] / "stations_geo.parquet"
        if not stations_geo_path.exists():
            raise FileNotFoundError(
                f"stations_geo.parquet not found at {stations_geo_path}. "
                "Run the spedition_mlp notebook's Station Discovery section first."
            )

        if self.debug:
            print(f"[GeoDataLoader] Loading station metadata (mode={self.mode}) …")
        df_stations = load_geo_stations(stations_geo_path, mode=self.mode)
        if self.debug:
            print(f"  {len(df_stations)} stations after geo filter")

        if self.debug:
            print("[GeoDataLoader] Computing competition density …")
        df_stations = enrich_station_features(df_stations)

        if self.cache and self._cache_path.exists() and not refresh:
            if self.debug:
                print(f"[GeoDataLoader] Loading from cache: {self._cache_path}")
            df_hourly = pd.read_parquet(self._cache_path)
        else:
            uuids = set(df_stations["uuid"])
            if self.debug:
                print(f"[GeoDataLoader] Loading raw prices for {len(uuids)} stations …")
            df_raw = load_raw_prices_parallel(
                self._cfg["data_path"], uuids, self.fuel_type,
                self.start_date, self.end_date,
            )
            if self.debug:
                print(f"  {len(df_raw):,} price events loaded")

            # Drop stations below the minimum event threshold
            event_counts = df_raw["station_uuid"].value_counts()
            active = set(event_counts[event_counts >= _MIN_EVENTS].index)
            df_stations = df_stations[df_stations["uuid"].isin(active)].reset_index(drop=True)
            df_raw = df_raw[df_raw["station_uuid"].isin(active)]
            if self.debug:
                print(f"  {len(df_stations)} stations with ≥{_MIN_EVENTS} events retained")

            df_hourly = aggregate_hourly_per_station(df_raw, self.fuel_type)

            if self.cache:
                df_hourly.to_parquet(self._cache_path)
                print(f"  Hourly cache saved: {self._cache_path}")

        # Fit brand target encoding on training period only (prevents leakage)
        if "brand" in df_stations.columns:
            self.brand_mean_map = self._fit_brand_encoding(df_hourly, df_stations)
        else:
            self.brand_mean_map = {}

        if self.debug:
            print("[GeoDataLoader] Building panel feature matrix …")
        X, y = build_panel_features(
            df_hourly, df_stations, self.fuel_type,
            self.stride, self.forecast_horizon, self.brand_mean_map,
        )
        if self.debug:
            print(f"[GeoDataLoader] Done: X={X.shape}, y={y.shape}")
        return X, y

    def _fit_brand_encoding(
        self,
        df_hourly: pd.DataFrame,
        df_stations: pd.DataFrame,
    ) -> dict:
        """Target mean encoding for brand using training period prices only."""
        train_hourly = df_hourly.loc[df_hourly.index <= pd.Timestamp(self._TRAIN_END)]
        uuid_to_brand = df_stations.set_index("uuid")["brand"].to_dict()

        records = []
        for uuid, brand in uuid_to_brand.items():
            if uuid in train_hourly.columns:
                mean_price = train_hourly[uuid].dropna().mean()
                if not np.isnan(mean_price):
                    records.append({"brand": str(brand or "unknown"), "price": mean_price})

        if not records:
            return {}

        brand_means = pd.DataFrame(records).groupby("brand")["price"].mean()
        brand_map = brand_means.to_dict()
        brand_map["__mean__"] = brand_means.mean()  # fallback for unseen brands
        return brand_map

    def train_val_test_split(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame,
               pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Temporal split matching the other loaders:
          train : start → 2021-12-31
          val   : 2022-01-01 → 2023-12-31
          test  : 2024-01-01 → present
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

    parser = argparse.ArgumentParser(description="Geo Data Loader — build panel feature cache")
    parser.add_argument("--mode",    default="bw",     choices=["bw", "full"])
    parser.add_argument("--start",   default="2022-01-01", metavar="YYYY-MM-DD")
    parser.add_argument("--end",     default=None,     metavar="YYYY-MM-DD")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--debug",   action="store_true")
    args = parser.parse_args()

    loader = GeoDataLoader(
        mode=args.mode, start_date=args.start, end_date=args.end,
        forecast_horizon=72, fuel_type="diesel", cache=True, debug=args.debug,
    )
    X, y = loader.load(refresh=args.refresh)
    loader.train_val_test_split(X, y)

    if args.debug:
        print("\nFeature columns:")
        for col in X.columns:
            print(f"  {col}")
