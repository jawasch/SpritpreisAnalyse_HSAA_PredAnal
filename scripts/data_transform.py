"""
B29 Corridor Data Loader — MLP Regressor feature pipeline.

Filters Tankerkönig event-based price CSVs to gas stations along the B29
(Aalen → Schwäbisch Gmünd → Schorndorf → Stuttgart), aggregates to hourly
cluster means, and builds a lag/rolling/trend feature matrix.

Usage
-----
    from scripts.data_transform import B29DataLoader

    loader = B29DataLoader(stride=0, forecast_horizon=24, fuel_type="diesel")
    X, y  = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)

CLI
---
    python scripts/data_transform.py [--refresh] [--fuel-type diesel] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv

# ── Constants ──────────────────────────────────────────────────────────────

# Four geographic clusters along the B29 (Aalen → Stuttgart)
B29_CLUSTERS_DEFAULT: dict[str, list[int]] = {
    "aalen":              [73430, 73431, 73432, 73433, 73434],           # Region A
    "schwaebisch_gmuend": [73525, 73526, 73527, 73528, 73529],           # Region B
    "schorndorf":         [73614, 73655, 73660, 71334, 71336],           # Region C
    "stuttgart":          [70173, 70174, 70176, 70180, 70182,            # Region D
                           70184, 70372, 70374, 70376, 70439],
}

# Lag offsets in hours (168 h = same time last week)
LAG_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168]

# Rolling window sizes for mean and std
ROLLING_WINDOWS = [6, 24, 48]

# Window for linear trend slope (hours)
TREND_WINDOW = 24

# Rows to discard after lag creation (= max lag, so first row has no NaN from lags)
WARMUP_ROWS = 168


# ── Configuration ───────────────────────────────────────────────────────────

def load_config() -> dict:
    """Read .env and return a config dict with resolved paths."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    load_dotenv(project_root / ".env")

    raw_path = os.getenv("TANKERKOENIG_DATA_PATH", "../tankerkoenig-data")
    data_path = (project_root / raw_path).resolve()

    clusters_json = os.getenv("B29_CLUSTERS_JSON")
    clusters = json.loads(clusters_json) if clusters_json else B29_CLUSTERS_DEFAULT

    processed_dir = project_root / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    return {
        "data_path": data_path,
        "clusters": clusters,
        "processed_dir": processed_dir,
    }


# ── Station loading ─────────────────────────────────────────────────────────

def load_stations(data_path: Path, clusters: dict[str, list[int]]) -> pd.DataFrame:
    """
    Read stations.csv and return DataFrame[uuid, cluster] restricted to
    the B29 corridor PLZ codes.
    """
    stations_path = data_path / "stations" / "stations.csv"
    stations = pd.read_csv(
        stations_path,
        usecols=["uuid", "post_code"],
        dtype={"uuid": str, "post_code": str},
    )

    # Normalize: strip whitespace, parse as integer (NaN → -1, non-numeric → -1)
    stations["plz"] = pd.to_numeric(
        stations["post_code"].str.strip(), errors="coerce"
    ).fillna(-1).astype(int)

    plz_to_cluster = {plz: name for name, plzs in clusters.items() for plz in plzs}
    stations["cluster"] = stations["plz"].map(plz_to_cluster)

    b29 = stations.dropna(subset=["cluster"])[["uuid", "cluster"]].reset_index(drop=True)
    return b29


# ── Price loading ───────────────────────────────────────────────────────────

def load_raw_prices(
    data_path: Path,
    station_uuids: set,
    fuel_type: str = "diesel",
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    """
    Scan all daily price CSVs (prices/YYYY/MM/YYYY-MM-DD-prices.csv),
    filter to B29 station UUIDs and the requested fuel type.

    Only valid prices (> 0.5 €/L) are kept.
    Results are returned sorted by date ascending.
    """
    prices_root = data_path / "prices"
    all_files = sorted(prices_root.rglob("*-prices.csv"))

    ts_start = pd.Timestamp(start_date) if start_date else None
    ts_end = pd.Timestamp(end_date) if end_date else None

    chunks: list[pd.DataFrame] = []
    skipped = 0

    for f in all_files:
        # filename: 2024-01-01-prices.csv
        date_str = f.stem.replace("-prices", "")
        try:
            file_date = pd.Timestamp(date_str)
        except Exception:
            skipped += 1
            continue

        if ts_start and file_date < ts_start:
            continue
        if ts_end and file_date > ts_end:
            continue

        try:
            df = pd.read_csv(
                f,
                usecols=["date", "station_uuid", fuel_type],
                dtype={"station_uuid": str, fuel_type: "float32"},
            )
        except Exception:
            skipped += 1
            continue

        df = df[df["station_uuid"].isin(station_uuids)]
        if not df.empty:
            chunks.append(df)

    if skipped:
        print(f"  (skipped {skipped} files with unexpected format)")

    if not chunks:
        raise ValueError(
            f"No price data found for B29 stations under {prices_root}. "
            "Check TANKERKOENIG_DATA_PATH in .env."
        )

    raw = pd.concat(chunks, ignore_index=True)
    raw["date"] = pd.to_datetime(raw["date"], utc=True)
    raw = raw.dropna(subset=[fuel_type])
    raw = raw[raw[fuel_type] > 0.5]  # remove zeroed/invalid entries
    raw = raw.sort_values("date").reset_index(drop=True)
    return raw


# ── Hourly aggregation ──────────────────────────────────────────────────────

def aggregate_hourly(
    df_raw: pd.DataFrame,
    df_stations: pd.DataFrame,
    fuel_type: str = "diesel",
) -> pd.DataFrame:
    """
    Event-mean aggregation: floor each price-change event to its hour bucket,
    average across all stations in the same cluster, then pivot to wide format.

    Sparse hours (no events in a cluster) are forward-filled up to 3 h to
    handle overnight low-activity periods.

    Returns
    -------
    pd.DataFrame
        Indexed by UTC+1 (Europe/Berlin) hourly timestamp.
        Columns: "{fuel_type}_{cluster}" for each cluster.
    """
    df = df_raw.merge(df_stations, left_on="station_uuid", right_on="uuid", how="inner")

    # Convert to Europe/Berlin naive timestamps and floor to hour
    df["ts"] = (
        df["date"]
        .dt.tz_convert("Europe/Berlin")
        .dt.tz_localize(None)
    )
    df["hour"] = df["ts"].dt.floor("h")

    hourly = (
        df.groupby(["hour", "cluster"])[fuel_type]
        .mean()
        .unstack("cluster")
    )

    # Reindex to a complete hourly range (no gaps)
    full_idx = pd.date_range(hourly.index.min(), hourly.index.max(), freq="h")
    hourly = hourly.reindex(full_idx)
    hourly = hourly.ffill(limit=3)

    hourly.index.name = "timestamp"
    hourly.columns = [f"{fuel_type}_{c}" for c in hourly.columns]
    return hourly


# ── Feature engineering ─────────────────────────────────────────────────────

def _rolling_linear_slope(series: pd.Series, window: int) -> pd.Series:
    """
    Rolling linear slope (€/L per hour) computed with numpy least-squares.
    Uses a fixed x-axis (0..window-1) so only y values change per window.
    """
    x = np.arange(window, dtype=np.float64)
    x -= x.mean()   # center for numerical stability
    x_ss = (x ** 2).sum()

    def _slope(y: np.ndarray) -> float:
        if np.isnan(y).any():
            return np.nan
        return float(np.dot(x, y - y.mean()) / x_ss)

    return series.rolling(window, min_periods=window).apply(_slope, raw=True)


def _is_holiday(timestamps: pd.DatetimeIndex) -> pd.Series:
    """Return bool Series: True when the date is a German public holiday (BW)."""
    try:
        import holidays  # pip install holidays
        bw_hols = holidays.Germany(
            state="BW", years=sorted(timestamps.year.unique().tolist())
        )
        return pd.Series(
            [ts.date() in bw_hols for ts in timestamps],
            index=timestamps,
            dtype=bool,
        )
    except ImportError:
        return pd.Series(False, index=timestamps, dtype=bool)


def build_features(
    df_hourly: pd.DataFrame,
    stride: int = 0,
    forecast_horizon: int = 24,
    fuel_type: str = "diesel",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build feature matrix X and target DataFrame y.

    Parameters
    ----------
    df_hourly : pd.DataFrame
        Wide hourly DataFrame with columns "{fuel_type}_{cluster}".
    stride : int
        Shifts the observation window `stride` hours into the past.
        stride=0  → predict price at t using features up to t (nowcast / 1-step)
        stride=24 → predict price at t using features known at t-24 (24h-ahead forecast)
    forecast_horizon : int
        Reserved for future multi-step output (currently unused in X/y construction).
    fuel_type : str
        Fuel type prefix to select from df_hourly.

    Returns
    -------
    X : pd.DataFrame  — feature columns (no current prices)
    y : pd.DataFrame  — target columns (current cluster prices)
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    df = df_hourly.copy()

    for col in price_cols:
        s = df[col]

        # Lag features (shifted back by stride so they are observable at t-stride)
        for lag in LAG_HOURS:
            df[f"{col}_lag_{lag}h"] = s.shift(lag + stride)

        # Price difference vs. 1h ago (momentum proxy)
        df[f"{col}_diff"] = s.shift(stride) - s.shift(1 + stride)

        # Rolling statistics over the window ending at t-stride
        for w in ROLLING_WINDOWS:
            df[f"{col}_roll_mean_{w}h"] = s.shift(stride).rolling(w, min_periods=w).mean()
            df[f"{col}_roll_std_{w}h"]  = s.shift(stride).rolling(w, min_periods=w).std()

        # Linear trend slope (€/L per hour) over the last TREND_WINDOW hours
        df[f"{col}_trend"] = _rolling_linear_slope(s.shift(stride), TREND_WINDOW)

        # Momentum: price acceleration (lag_1h minus lag_24h)
        df[f"{col}_momentum"] = s.shift(1 + stride) - s.shift(24 + stride)

    # Global time features
    idx = df.index
    df["hour"]       = idx.hour
    df["day_of_week"] = idx.dayofweek
    df["is_weekend"] = (idx.dayofweek >= 5).astype(np.int8)
    df["is_holiday"] = _is_holiday(idx).astype(np.int8)

    # Drop warmup rows (first WARMUP_ROWS rows have NaN from 168h lag)
    df = df.iloc[WARMUP_ROWS:].copy()

    # Target: current cluster prices
    y = df[price_cols].copy()

    # Features: everything except the raw current prices
    feature_cols = [c for c in df.columns if c not in price_cols]
    X = df[feature_cols].copy()

    return X, y


# ── DataLoader ──────────────────────────────────────────────────────────────

class B29DataLoader:
    """
    One-stop loader for the B29 corridor MLP pipeline.

    Caches the intermediate hourly parquet to data/processed/ so the
    87 GB raw CSV scan runs at most once per fuel type.

    Example
    -------
        loader = B29DataLoader(stride=0, fuel_type="diesel")
        X, y = loader.load()
        X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
    """

    # Temporal split boundaries (inclusive end of train / val)
    _TRAIN_END = "2021-12-31 23:00"
    _VAL_END   = "2023-12-31 23:00"

    def __init__(
        self,
        stride: int = 0,
        forecast_horizon: int = 24,
        fuel_type: str = "diesel",
        cache: bool = True,
    ):
        self.stride = stride
        self.forecast_horizon = forecast_horizon
        self.fuel_type = fuel_type
        self.cache = cache
        self._cfg = load_config()

    @property
    def cache_path(self) -> Path:
        return self._cfg["processed_dir"] / f"b29_hourly_{self.fuel_type}.parquet"

    def load(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        refresh: bool = False,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Return (X, y) feature matrices.

        If a cached parquet exists and `refresh` is False, the raw CSV scan
        is skipped entirely.
        """
        if self.cache and self.cache_path.exists() and not refresh:
            print(f"[B29DataLoader] Loading from cache: {self.cache_path}")
            df_hourly = pd.read_parquet(self.cache_path)
        else:
            cfg = self._cfg
            print(f"[B29DataLoader] Scanning stations …")
            df_stations = load_stations(cfg["data_path"], cfg["clusters"])

            counts = df_stations.groupby("cluster")["uuid"].count()
            print("  Station counts per B29 cluster:")
            for cluster, n in counts.items():
                print(f"    {cluster:22s}: {n:3d} stations")

            uuids = set(df_stations["uuid"])
            total = counts.sum()
            print(f"\n[B29DataLoader] Loading raw prices for {total} stations …")
            df_raw = load_raw_prices(
                cfg["data_path"], uuids, self.fuel_type, start_date, end_date
            )
            print(f"  {len(df_raw):,} price events loaded")

            print("[B29DataLoader] Aggregating to hourly cluster means …")
            df_hourly = aggregate_hourly(df_raw, df_stations, self.fuel_type)
            print(f"  Hourly shape: {df_hourly.shape}  "
                  f"({df_hourly.index.min()} → {df_hourly.index.max()})")

            if self.cache:
                df_hourly.to_parquet(self.cache_path)
                print(f"  Cached to: {self.cache_path}")

        X, y = build_features(
            df_hourly, self.stride, self.forecast_horizon, self.fuel_type
        )
        print(f"[B29DataLoader] Feature matrix ready: X={X.shape}, y={y.shape}")
        return X, y

    def train_val_test_split(
        self,
        X: pd.DataFrame,
        y: pd.DataFrame,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame,
               pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Temporal split (no shuffle) matching the national notebook split:
          train : 2014-06 → 2021-12
          val   : 2022-01 → 2023-12
          test  : 2024-01 → present
        """
        X_train = X.loc[: self._TRAIN_END]
        X_val   = X.loc[self._TRAIN_END : self._VAL_END].iloc[1:]
        X_test  = X.loc[self._VAL_END :].iloc[1:]

        y_train = y.loc[: self._TRAIN_END]
        y_val   = y.loc[self._TRAIN_END : self._VAL_END].iloc[1:]
        y_test  = y.loc[self._VAL_END :].iloc[1:]

        print(f"  Train : {X_train.index[0]}  →  {X_train.index[-1]}  ({len(X_train):,} rows)")
        print(f"  Val   : {X_val.index[0]}  →  {X_val.index[-1]}  ({len(X_val):,} rows)")
        print(f"  Test  : {X_test.index[0]}  →  {X_test.index[-1]}  ({len(X_test):,} rows)")

        return X_train, X_val, X_test, y_train, y_val, y_test


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="B29 Data Loader — build or refresh hourly feature cache"
    )
    parser.add_argument(
        "--refresh", action="store_true",
        help="Rebuild parquet cache from raw CSVs even if it already exists"
    )
    parser.add_argument(
        "--fuel-type", default="diesel", choices=["diesel", "e5", "e10"],
        help="Fuel type to process (default: diesel)"
    )
    parser.add_argument("--start", default=None, metavar="YYYY-MM-DD",
                        help="Only load data from this date onwards")
    parser.add_argument("--end",   default=None, metavar="YYYY-MM-DD",
                        help="Only load data up to this date")
    args = parser.parse_args()

    loader = B29DataLoader(fuel_type=args.fuel_type, stride=0, cache=True)
    X, y = loader.load(start_date=args.start, end_date=args.end, refresh=args.refresh)
    loader.train_val_test_split(X, y)

    print("\nFeature columns:")
    for col in X.columns:
        print(f"  {col}")
