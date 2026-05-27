"""
B29 Corridor Data Loader — MLP Regressor feature pipeline.

Filters Tankerkönig event-based price CSVs to gas stations along the B29
(Aalen → Schwäbisch Gmünd → Schorndorf → Stuttgart), aggregates to hourly
cluster means, and builds a lag/rolling/trend feature matrix.

Usage
-----
    from scripts.data_transform import B29DataLoader

    loader = B29DataLoader(stride=0, forecast_horizon=24, fuel_type="diesel", debug=True)
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

# Debug flag to control verbose output (now a parameter)
DEBUG = False

# ── Constants ──────────────────────────────────────────────────────────────

# Four geographic clusters along the B29 (Aalen → Stuttgart)
B29_CLUSTERS_DEFAULT: dict[str, list[int]] = {
    "Aalen":              [73430, 73431, 73432, 73433, 73434],           # Region A
    "Schwäbisch Gmünd": [73525, 73526, 73527, 73528, 73529],           # Region B
    "Schorndorf":         [73614, 73655, 73660, 71334, 71336],           # Region C
    "Stuttgart":          [70173, 70174, 70176, 70178, 70180, 70182, 70184, 70186, 70188, 70190,
                            70191, 70192, 70193, 70195, 70197, 70199, 70327, 70329, 70372, 70374,
                            70376, 70378, 70435, 70437, 70439, 70469, 70476, 70499, 70563, 70565,
                            70567, 70569, 70597, 70599, 70619, 70629],   # Region D
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
    # Vorsicht: hier wird nur stations.csv eingelesen obwohl jede prices.csv eine korrespondierende stations.csv hat!
    
    if DEBUG:
        print(f"[DEBUG] Loading stations from {stations_path}")

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

    if DEBUG:
        print(f"[DEBUG] Found {len(b29)} stations in B29 clusters: {b29['cluster'].value_counts()}")

    return b29

# ── Price loading ───────────────────────────────────────────────────────────

def _normalize_end_timestamp(end_date: str | None) -> pd.Timestamp | None:
    if end_date is None:
        return None
    ts = pd.Timestamp(end_date)
    if isinstance(end_date, str) and len(end_date) <= 10 and ts.time() == pd.Timestamp("00:00:00").time():
        ts = ts + pd.Timedelta(days=1) - pd.Timedelta(hours=1)
    return ts


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

    if DEBUG:
        print(f"[DEBUG] Searching for prices in {prices_root}")
        print(f"[DEBUG] Found {len(all_files)} price files")

    ts_start = pd.Timestamp(start_date) if start_date else None
    ts_end = _normalize_end_timestamp(end_date)

    chunks: list[pd.DataFrame] = []
    skipped = 0

    for f in all_files:
        # filename: 2024-01-01-prices.csv
        date_str = f.stem.replace("-prices", "")
        try:
            file_date = pd.Timestamp(date_str)
        except Exception as e:
            skipped += 1
            if DEBUG:
                print(f"[DEBUG] Skipped {f} (invalid date): {e}")
            continue

        if ts_start and file_date < ts_start:
            if DEBUG:
                print(f"[DEBUG] Skipping {f} (before start date)")
            continue
        if ts_end and file_date > ts_end:
            if DEBUG:
                print(f"[DEBUG] Skipping {f} (after end date)")
            continue

        try:
            df = pd.read_csv(
                f,
                usecols=["date", "station_uuid", fuel_type],
                dtype={"station_uuid": str, fuel_type: "float32"},
            )
        except Exception as e:
            skipped += 1
            if DEBUG:
                print(f"[DEBUG] Skipped {f} (read error): {e}")
            continue

        df = df[df["station_uuid"].isin(station_uuids)]
        if not df.empty:
            chunks.append(df)

    if skipped and DEBUG:
        print(f"[DEBUG] Skipped {skipped} files due to errors")

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

    if DEBUG:
        print(f"[DEBUG] Loaded {len(raw):,} price events for {fuel_type}")
        print(f"[DEBUG] Date range: {raw['date'].min()} to {raw['date'].max()}")

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
    # Forward-fill without limit: carry the last known cluster price until the
    # next price-change event. This correctly answers "what would you pay at h?"
    hourly = hourly.ffill()

    hourly.index.name = "timestamp"
    hourly.columns = [f"{fuel_type}_{c}" for c in hourly.columns]

    nan_pct = hourly.isna().mean().mul(100).round(1)
    if DEBUG:
        print(f"[DEBUG] NaN % per cluster after ffill: {nan_pct.to_dict()}")

    return hourly

# ── Feature engineering ─────────────────────────────────────────────────────

def _rolling_linear_slope(series: pd.Series, window: int) -> pd.Series:
    """
    Rolling linear slope (€/L per hour) computed with numpy least-squares.
    Uses a fixed x-axis (0..window-1) so only y values change per window.
    """
    x = np.arange(window, dtype=np.float64)
    x -= x.mean()   # center for numerical stability
    x_ss = (x ** 2).sum() # Summe der Quadrate

    def _slope(y: np.ndarray) -> float:
        if np.isnan(y).any():
            return np.nan
        return float(np.dot(x, y - y.mean()) / x_ss) # Berechnung der Steigung (slope) mit numpy least-squares

    return series.rolling(window, min_periods=window).apply(_slope, raw=True) # Berechnung der linearen Steigung über das rollende Fenster

def _is_holiday(timestamps: pd.DatetimeIndex) -> pd.Series:
    """Return bool Series: True when the date is a German public holiday (BW)."""
    try:
        import holidays  # pip install holidays
        bw_hols = holidays.country_holidays(
            "DE", subdiv="BW", years=sorted(timestamps.year.unique().tolist())
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
    Build feature matrix X and multi-horizon target DataFrame y.

    Parameters
    ----------
    df_hourly : pd.DataFrame
        Wide hourly DataFrame with columns "{fuel_type}_{cluster}".
    stride : int
        Shifts the observation window `stride` hours into the past.
        stride=0  → features known at t
        stride=24 → features known at t-24
    forecast_horizon : int
        Number of future hours to predict directly (t+1 … t+H).
    fuel_type : str
        Fuel type prefix to select from df_hourly.

    Returns
    -------
    X : pd.DataFrame  — feature columns (known at prediction time)
    y : pd.DataFrame  — target columns (multi-step future prices)
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    df = df_hourly.copy()

    for col in price_cols:
        s = df[col]

        # Lag features (shifted back by stride so they are observable at t-stride)
        for lag in LAG_HOURS:
            df[f"{col}_lag_{lag}h"] = s.shift(lag + stride)

        df[f"{col}_price_t"] = s.shift(stride)
        df[f"{col}_diff"] = s.shift(stride) - s.shift(1 + stride)

        for w in ROLLING_WINDOWS:
            df[f"{col}_roll_mean_{w}h"] = s.shift(stride).rolling(w, min_periods=w).mean()
            df[f"{col}_roll_std_{w}h"] = s.shift(stride).rolling(w, min_periods=w).std()

        df[f"{col}_trend"] = _rolling_linear_slope(s.shift(stride), TREND_WINDOW)
        df[f"{col}_momentum"] = s.shift(1 + stride) - s.shift(24 + stride)

    idx = df.index
    df["hour"] = idx.hour
    df["day_of_week"] = idx.dayofweek
    df["is_weekend"] = (idx.dayofweek >= 5).astype(np.int8)
    df["is_holiday"] = _is_holiday(idx).astype(np.int8)

    target_cols: list[str] = []
    for step in range(1, forecast_horizon + 1):
        for col in price_cols:
            target_col = f"{col}_t+{step}h"
            df[target_col] = df[col].shift(-step)
            target_cols.append(target_col)

    df = df.iloc[WARMUP_ROWS:].copy()
    df = df.dropna(subset=target_cols)

    y = df[target_cols].copy()

    excluded_cols = set(price_cols + target_cols)
    feature_cols = [c for c in df.columns if c not in excluded_cols]
    X = df[feature_cols].copy()

    return X, y

# ── DataLoader ──────────────────────────────────────────────────────────────

# Modify the B29DataLoader class to ensure configuration is always loaded
class B29DataLoader:
    """
    One-stop loader for the B29 corridor MLP pipeline.

    Caches the intermediate hourly parquet to data/processed/ so the
    87 GB raw CSV scan runs at most once per fuel type.

    Example
    -------
        loader = B29DataLoader(stride=0, fuel_type="diesel", debug=True)
        X, y = loader.load()
        X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)
    """

    # Temporal split boundaries (inclusive end of train / val)
    # Dynamische Berechnung der Grenzen könnte hier sinnvoll sein, z.B. basierend auf den Daten in df_hourly oder als Parameterübergabe, um Flexibilität zu gewährleisten.
    
    _TRAIN_END = "2021-12-31 23:00" # TODO: diese Grenzen sollten eigentlich als Parameter übergeben werden, damit sie flexibel sind und nicht hart im Code stehen!
    _VAL_END   = "2023-12-31 23:00" # TODO: siehe oben

    def __init__(
        self,
        stride: int = 0,
        forecast_horizon: int = 72,
        fuel_type: str = "diesel",
        cache: bool = True,
        debug: bool = False,
        start_date: str | None = None,
        end_date: str | None = None,
    ):
        self.stride = stride
        self.forecast_horizon = forecast_horizon
        self.fuel_type = fuel_type
        self.cache = cache
        self.debug = debug
        self.start_date = start_date
        self.end_date = end_date

        global DEBUG
        DEBUG = debug  # Update the module-level constant

        # Initialize configuration immediately
        self._cfg = load_config()  # Ensure config is loaded

    def _cache_path_for_dates(self, start_date: str | None, end_date: str | None) -> Path:
        start_key = (start_date or "all").replace(":", "-").replace(" ", "T")
        end_key = (end_date or "all").replace(":", "-").replace(" ", "T")
        return self._cfg["processed_dir"] / (
            f"b29_hourly_{self.fuel_type}_{start_key}_{end_key}.parquet"
        )

    @property
    def cache_path(self) -> Path:
        return self._cache_path_for_dates(self.start_date, self.end_date)

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
        global DEBUG
        if DEBUG:
            print("[B29DataLoader] DEBUG mode enabled")

        # Configuration is already loaded in __init__

        start_date_eff = start_date or self.start_date
        end_date_eff = end_date or self.end_date
        cache_path_eff = self._cache_path_for_dates(start_date_eff, end_date_eff)

        if self.cache and cache_path_eff.exists() and not refresh:
            print(f"[B29DataLoader] Loading from cache: {cache_path_eff}")
            df_hourly = pd.read_parquet(cache_path_eff)
        else:
            if DEBUG:
                print(f"[B29DataLoader] Scanning stations …")

            df_stations = load_stations(self._cfg["data_path"], self._cfg["clusters"])

            counts = df_stations.groupby("cluster")["uuid"].count()
            if DEBUG:
                print("  Station counts per B29 cluster:")
                for cluster, n in counts.items():
                    print(f"    {cluster:22s}: {n:3d} stations")

            uuids = set(df_stations["uuid"])
            total = counts.sum()
            if DEBUG:
                print(f"\n[B29DataLoader] Loading raw prices for {total} stations …")
            df_raw = load_raw_prices(
                self._cfg["data_path"], uuids, self.fuel_type, start_date_eff, end_date_eff
            )
            if DEBUG:
                print(f"  {len(df_raw):,} price events loaded")

            if DEBUG:
                print("[B29DataLoader] Aggregating to hourly cluster means …")
            df_hourly = aggregate_hourly(df_raw, df_stations, self.fuel_type)
            if DEBUG:
                print(f"  Hourly shape: {df_hourly.shape}  "
                        f"({df_hourly.index.min()} → {df_hourly.index.max()})")

            if self.cache:
                df_hourly.to_parquet(cache_path_eff)
                print(f"  Cached to: {cache_path_eff}")

        X, y = build_features(
            df_hourly, self.stride, self.forecast_horizon, self.fuel_type
        )
        if DEBUG:
            print(f"[B29DataLoader] Feature matrix ready: X={X.shape}, y={y.shape}")
        return X, y

    # Rest of the class methods remain unchanged...

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
        train_end = min(pd.Timestamp(self._TRAIN_END), X.index.max())
        val_end = min(pd.Timestamp(self._VAL_END), X.index.max())

        X_train = X.loc[:train_end]
        y_train = y.loc[:train_end]

        X_val = X.loc[train_end:val_end].iloc[1:] if train_end < val_end else X.iloc[0:0]
        y_val = y.loc[train_end:val_end].iloc[1:] if train_end < val_end else y.iloc[0:0]

        X_test = X.loc[val_end:].iloc[1:] if val_end < X.index.max() else X.iloc[0:0]
        y_test = y.loc[val_end:].iloc[1:] if val_end < y.index.max() else y.iloc[0:0]

        def _fmt_range(df: pd.DataFrame) -> str:
            if df.empty:
                return "empty"
            return f"{df.index[0]}  →  {df.index[-1]}"

        print(f"  Train : {_fmt_range(X_train)}  ({len(X_train):,} rows)")
        print(f"  Val   : {_fmt_range(X_val)}  ({len(X_val):,} rows)")
        print(f"  Test  : {_fmt_range(X_test)}  ({len(X_test):,} rows)")

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
    parser.add_argument(
        "--debug", action="store_true",
        help="Enable verbose debug output"
    )
    args = parser.parse_args()

    loader = B29DataLoader(
        fuel_type=args.fuel_type,
        stride=0,
        cache=True,
        debug=args.debug
    )
    X, y = loader.load(start_date=args.start, end_date=args.end, refresh=args.refresh)
    loader.train_val_test_split(X, y)

    if args.debug:
        print("\nFeature columns:")
        for col in X.columns:
            print(f"  {col}")