"""
ML inference service — loads trained .joblib artifacts and generates real forecasts.

Spedition MLP: data/models/spedition_mlp.joblib (101 features → 360 targets)
B29 Fleet MLP: data/models/b29_mlp.joblib  (if present; persistence fallback otherwise)

Feature engineering replicates data_transform_spedition.py / data_transform.py exactly.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Paths (configurable via DATA_DIR env var for local dev vs Docker) ──────────
import os as _os
DATA_DIR      = Path(_os.getenv("DATA_DIR", "/app/data"))
MODELS_DIR    = DATA_DIR / "models"
PROCESSED_DIR = DATA_DIR / "processed"

SPEDITION_MODEL   = MODELS_DIR    / "spedition_mlp.joblib"
B29_MODEL         = MODELS_DIR    / "b29_mlp.joblib"
SPEDITION_PARQUET = PROCESSED_DIR / "spedition_5stations_diesel_all_all.parquet"
B29_PARQUET       = PROCESSED_DIR / "b29_hourly_diesel_all_all.parquet"
STATIONS_GEO      = PROCESSED_DIR / "stations_geo.parquet"

# Paths for all-Germany models (created by notebooks/all_germany_web_mlp.ipynb)
ALL_GERMANY_MODELS = {
    ft: MODELS_DIR / f"all_germany_{ft}_mlp.joblib"
    for ft in ("diesel", "e5", "e10")
}
ALL_GERMANY_PARQUET = PROCESSED_DIR / "all_germany_grid_all_fuels.parquet"

# ── Brand price offsets (matches mock_data.py; case-insensitive lookup) ────────
_BRAND_OFFSET: dict[str, float] = {
    "aral": 0.032, "shell": 0.028, "bp": 0.018, "esso": 0.014,
    "agip": 0.015, "total": 0.005, "avia": 0.000, "westfalen": -0.008,
    "q1": -0.012, "star": -0.025, "hem": -0.032, "jet": -0.038,
}

def _brand_offset(brand: str) -> float:
    return _BRAND_OFFSET.get(brand.lower(), 0.0)

# Hour-of-day intraday price offset (index = hour 0–23), matches mock_data.py
_HOUR_OFFSETS: list[float] = [
    -0.010, -0.012, -0.014, -0.014, -0.010, -0.005,
     0.010,  0.022,  0.025,  0.020, -0.005, -0.012,
    -0.015, -0.015, -0.010, -0.005,  0.000,  0.008,
     0.012,  0.010,  0.005,  0.000, -0.005, -0.008,
]
_WEEKDAY_OFFSETS: list[float] = [0.012, 0.010, 0.005, 0.000, -0.005, -0.015, -0.018]

# Typical German fuel price ratios (E5 and E10 relative to Diesel)
_FUEL_RATIO = {"diesel": 1.0, "e5": 1.062, "e10": 1.037}

# Day-name lookup for German insight texts
_DAY_NAMES_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

# B29 cluster geographic centroids for 3D map positioning
_B29_CENTROIDS = {
    "Aalen":            {"lat": 48.8375, "lng": 10.0931},
    "Schwäbisch Gmünd": {"lat": 48.7978, "lng":  9.7994},
    "Schorndorf":       {"lat": 48.8047, "lng":  9.5295},
    "Stuttgart":        {"lat": 48.7758, "lng":  9.1829},
}

# ── Feature engineering constants (must match data_transform_spedition.py) ─────
LAG_HOURS      = [1, 2, 3, 6, 12, 24, 48, 72, 168]
ROLLING_WINDOWS = [6, 24, 48]
TREND_WINDOW   = 24

# ── Station / cluster metadata ─────────────────────────────────────────────────
ROUTE_META: dict[str, dict] = {
    "Route_E":  {"name": "ESSO Olching",    "distance_km": 114, "color": "#f59e0b",
                 "uuid": "19275bf1-8186-47d8-b5eb-261431afaced",
                 "lat": 48.2024, "lng": 11.3308},
    "Route_N":  {"name": "AVIA Ipsheim",    "distance_km": 81,  "color": "#3b82f6",
                 "uuid": "af8b14d6-0af5-4d86-a2d5-947dc569fd9a",
                 "lat": 49.2698, "lng": 10.4901},
    "Route_NE": {"name": "AVIA Nürnberg",   "distance_km": 90,  "color": "#8b5cf6",
                 "uuid": "db307731-f6c4-4c45-9af4-1058e9b23397",
                 "lat": 49.4521, "lng": 11.0767},
    "Route_NW": {"name": "AVIA Mühlhausen", "distance_km": 109, "color": "#22c55e",
                 "uuid": "7bbb852b-e04e-48db-a1ee-8835cdbb9757",
                 "lat": 48.9425, "lng":  9.2765},
    "Route_SW": {"name": "RAN Biberach",    "distance_km": 86,  "color": "#ef4444",
                 "uuid": "62c42eb1-3776-4c5c-aec5-22148a267465",
                 "lat": 48.0984, "lng":  9.7835},
}

B29_CLUSTER_META: dict[str, dict] = {
    "Aalen":            {"color": "#3b82f6"},
    "Schwäbisch Gmünd": {"color": "#8b5cf6"},
    "Schorndorf":       {"color": "#f59e0b"},
    "Stuttgart":        {"color": "#ef4444"},
}

# Evaluation metrics hardcoded from notebook test-set results (not re-computed at inference)
_SPEDITION_PICK_ACCURACY = [
    {"horizon_h": 1,  "accuracy": 0.61},
    {"horizon_h": 6,  "accuracy": 0.59},
    {"horizon_h": 12, "accuracy": 0.58},
    {"horizon_h": 24, "accuracy": 0.57},
    {"horizon_h": 36, "accuracy": 0.55},
    {"horizon_h": 48, "accuracy": 0.54},
    {"horizon_h": 60, "accuracy": 0.53},
    {"horizon_h": 72, "accuracy": 0.52},
]

_SPEDITION_SPEARMAN = [
    {"horizon_h": 1,  "rho": 0.78},
    {"horizon_h": 6,  "rho": 0.77},
    {"horizon_h": 12, "rho": 0.75},
    {"horizon_h": 24, "rho": 0.72},
    {"horizon_h": 36, "rho": 0.68},
    {"horizon_h": 48, "rho": 0.65},
    {"horizon_h": 60, "rho": 0.63},
    {"horizon_h": 72, "rho": 0.62},
]

_B29_MAE_BY_HORIZON = [
    {"horizon_h": 1,  "mlp_mae": 0.028, "baseline_mae": 0.036},
    {"horizon_h": 6,  "mlp_mae": 0.029, "baseline_mae": 0.037},
    {"horizon_h": 12, "mlp_mae": 0.030, "baseline_mae": 0.038},
    {"horizon_h": 24, "mlp_mae": 0.032, "baseline_mae": 0.041},
    {"horizon_h": 36, "mlp_mae": 0.034, "baseline_mae": 0.043},
    {"horizon_h": 48, "mlp_mae": 0.036, "baseline_mae": 0.045},
    {"horizon_h": 60, "mlp_mae": 0.038, "baseline_mae": 0.048},
    {"horizon_h": 72, "mlp_mae": 0.040, "baseline_mae": 0.050},
]


# ── Feature engineering ────────────────────────────────────────────────────────

def _rolling_linear_slope(series: pd.Series, window: int) -> pd.Series:
    """Rolling least-squares slope — exact replica of data_transform.py."""
    x = np.arange(window, dtype=np.float64)
    x -= x.mean()
    x_ss = (x ** 2).sum()

    def _slope(y: np.ndarray) -> float:
        if np.isnan(y).any():
            return np.nan
        return float(np.dot(x, y - y.mean()) / x_ss)

    return series.rolling(window, min_periods=window).apply(_slope, raw=True)


def _is_holiday(idx: pd.DatetimeIndex) -> pd.Series:
    try:
        import holidays
        bw_hols = holidays.country_holidays(
            "DE", subdiv="BW", years=sorted(idx.year.unique().tolist())
        )
        return pd.Series([ts.date() in bw_hols for ts in idx], index=idx, dtype=bool)
    except ImportError:
        return pd.Series(False, index=idx, dtype=bool)


def _build_features(df_hourly: pd.DataFrame, fuel_type: str = "diesel") -> pd.DataFrame:
    """
    Build feature matrix from a wide hourly price DataFrame (stride=0, inference mode).
    Uses pd.concat to avoid DataFrame fragmentation.
    Replicates build_features() from data_transform_spedition.py exactly.
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    series: dict[str, pd.Series] = {}

    for col in price_cols:
        s = df_hourly[col]

        for lag in LAG_HOURS:
            series[f"{col}_lag_{lag}h"] = s.shift(lag)

        series[f"{col}_price_t"] = s
        series[f"{col}_diff"]    = s - s.shift(1)

        for w in ROLLING_WINDOWS:
            series[f"{col}_roll_mean_{w}h"] = s.rolling(w, min_periods=w).mean()
            series[f"{col}_roll_std_{w}h"]  = s.rolling(w, min_periods=w).std()

        series[f"{col}_trend"]    = _rolling_linear_slope(s, TREND_WINDOW)
        series[f"{col}_momentum"] = s.shift(1) - s.shift(24)

    idx = df_hourly.index
    series["hour_sin"]   = pd.Series(np.sin(2 * np.pi * idx.hour / 24),   index=idx)
    series["hour_cos"]   = pd.Series(np.cos(2 * np.pi * idx.hour / 24),   index=idx)
    series["dow_sin"]    = pd.Series(np.sin(2 * np.pi * idx.dayofweek / 7), index=idx)
    series["dow_cos"]    = pd.Series(np.cos(2 * np.pi * idx.dayofweek / 7), index=idx)
    series["is_weekend"] = pd.Series((idx.dayofweek >= 5).astype(np.int8),  index=idx)
    series["is_holiday"] = _is_holiday(idx).astype(np.int8)

    return pd.DataFrame(series, index=idx)


# ── MLService ──────────────────────────────────────────────────────────────────

RECENT_PRICES_TEMPLATE = PROCESSED_DIR / "recent_prices_{fuel_type}_7d.parquet"


class MLService:
    def __init__(self) -> None:
        self._sp_artifact: dict | None = None
        self._b29_artifact: dict | None = None
        self._sp_df: pd.DataFrame | None = None
        self._b29_df: pd.DataFrame | None = None
        self._geo_df: pd.DataFrame | None = None   # stations_geo.parquet cache
        self._ag_df: pd.DataFrame | None = None    # combined all-germany parquet cache
        self._recent_prices: dict[str, pd.DataFrame] = {}  # fuel_type → recent_prices df

    # ── Loaders ────────────────────────────────────────────────────────────────

    def _load_spedition(self) -> tuple[dict, pd.DataFrame]:
        if self._sp_artifact is None:
            import joblib
            logger.info("[ml_service] Loading spedition_mlp.joblib …")
            self._sp_artifact = joblib.load(SPEDITION_MODEL)
            logger.info("[ml_service] Spedition artifact loaded (features=%d, targets=%d)",
                        len(self._sp_artifact["feature_columns"]),
                        len(self._sp_artifact["target_columns"]))
        if self._sp_df is None:
            logger.info("[ml_service] Loading spedition parquet …")
            self._sp_df = pd.read_parquet(SPEDITION_PARQUET)
            logger.info("[ml_service] Spedition parquet loaded, shape=%s, last=%s",
                        self._sp_df.shape, self._sp_df.index[-1])
        return self._sp_artifact, self._sp_df

    def _load_stations_geo(self) -> pd.DataFrame:
        if self._geo_df is None:
            logger.info("[ml_service] Loading stations_geo.parquet …")
            self._geo_df = pd.read_parquet(STATIONS_GEO)
            logger.info("[ml_service] stations_geo loaded, shape=%s", self._geo_df.shape)
        return self._geo_df

    def _load_recent_prices(self, fuel_type: str = "diesel") -> pd.DataFrame | None:
        """Load recent real prices for all stations (built by build_recent_prices.py)."""
        if fuel_type not in self._recent_prices:
            path = Path(str(RECENT_PRICES_TEMPLATE).replace("{fuel_type}", fuel_type))
            if path.exists():
                logger.info("[ml_service] Loading recent_prices_%s_7d.parquet …", fuel_type)
                df = pd.read_parquet(path)
                self._recent_prices[fuel_type] = df
                logger.info("[ml_service] recent_prices loaded: %d stations", len(df))
            else:
                self._recent_prices[fuel_type] = None
        return self._recent_prices.get(fuel_type)

    def _load_b29(self) -> tuple[dict | None, pd.DataFrame]:
        if self._b29_df is None:
            logger.info("[ml_service] Loading B29 parquet …")
            self._b29_df = pd.read_parquet(B29_PARQUET)
            logger.info("[ml_service] B29 parquet loaded, shape=%s", self._b29_df.shape)

        if self._b29_artifact is None and B29_MODEL.exists():
            import joblib
            logger.info("[ml_service] Loading b29_mlp.joblib …")
            self._b29_artifact = joblib.load(B29_MODEL)

        if not B29_MODEL.exists():
            logger.warning("[ml_service] b29_mlp.joblib not found — using persistence fallback. "
                           "Run notebooks/b29_fleet_mlp.ipynb to generate the model.")

        return self._b29_artifact, self._b29_df

    # ── Inference ──────────────────────────────────────────────────────────────

    def predict_spedition(self, live_prices: dict[str, float] | None = None) -> dict:
        """
        Generate a 72-hour diesel forecast for 5 Spedition stations.

        live_prices: {uuid: price_eur_per_liter} from Tankerkönig API.
                     When provided, overrides the last-parquet current_price in recommendations.
        """
        artifact, df = self._load_spedition()

        # Only last 200 rows are needed for all lag/rolling windows (max lag = 168h)
        feat_df = _build_features(df.iloc[-200:])
        last_row = feat_df.iloc[[-1]]
        feature_cols = artifact["feature_columns"]
        X = last_row[feature_cols]  # DataFrame keeps feature names → no sklearn warning

        model    = artifact["model"]
        scaler_X = artifact["scaler_X"]
        scaler_y = artifact["scaler_y"]

        y_scaled = model.predict(scaler_X.transform(X))          # (1, 360)
        y_pred   = scaler_y.inverse_transform(y_scaled)[0]        # (360,)

        target_cols = artifact["target_columns"]  # e.g. "diesel_Route_E_t+1h"
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        # Build per-station forecast arrays {route_key: {h: price}}
        forecasts: dict[str, dict[int, float]] = {k: {} for k in ROUTE_META}
        for i, col_name in enumerate(target_cols):
            # col_name: "diesel_Route_E_t+1h"
            parts = col_name.rsplit("_t+", 1)
            if len(parts) != 2:
                continue
            route_key = parts[0].replace("diesel_", "")   # "Route_E"
            horizon_h = int(parts[1].rstrip("h"))
            if route_key in forecasts:
                forecasts[route_key][horizon_h] = float(round(y_pred[i], 4))

        # Build live-price lookup by route (uuid → price)
        uuid_to_price: dict[str, float] = live_prices or {}

        stations_out = []
        for route_key, meta in ROUTE_META.items():
            forecast_list = [
                {"hour_offset": h, "predicted_price": forecasts[route_key].get(h, 0.0)}
                for h in range(1, 73)
            ]
            # Current price: live API → fallback to last parquet value
            last_parquet_price = float(round(df[f"diesel_{route_key}"].iloc[-1], 4))
            current_price = uuid_to_price.get(meta["uuid"], last_parquet_price)

            stations_out.append({
                "id":          route_key.lower().replace("_", "-"),
                "name":        meta["name"],
                "route":       route_key,
                "distance_km": meta["distance_km"],
                "color":       meta["color"],
                "current_price": round(current_price, 4),
                "forecast":    forecast_list,
            })

        # Recommendations: for each station, find the optimal window
        recommendations = []
        for s in stations_out:
            best = min(s["forecast"], key=lambda f: f["predicted_price"])
            optimal_dt = now + timedelta(hours=best["hour_offset"])
            recommendations.append({
                "route":               s["route"],
                "station_name":        s["name"],
                "distance_km":         s["distance_km"],
                "current_price":       s["current_price"],
                "predicted_best_price": best["predicted_price"],
                "best_hour_offset":    best["hour_offset"],
                "optimal_time_label":  f"{optimal_dt.strftime('%d.%m. %H:%M')} Uhr",
                "savings_vs_now":      round(s["current_price"] - best["predicted_price"], 4),
            })
        recommendations.sort(key=lambda r: r["current_price"])

        return {
            "ok":           True,
            "generated_at": now.isoformat(),
            "data_source":  "parquet + spedition_mlp.joblib",
            "parquet_last": str(df.index[-1]),
            "live_prices_used": bool(live_prices),
            "model": {
                "name":                    "Spedition MLP",
                "architecture":            "101→[256,128]→360",
                "mae":                     0.0377,
                "r2":                      0.9278,
                "spearman_avg":            0.75,
                "pick_accuracy_t1":        0.61,
                "baseline_pick_accuracy":  0.20,
            },
            "savings": {"per_day_eur": 17.0, "per_year_eur": 6205.0, "trucks": 5},
            "stations":                  stations_out,
            "recommendations":           recommendations,
            "pick_accuracy_by_horizon":  _SPEDITION_PICK_ACCURACY,
            "spearman_by_horizon":       _SPEDITION_SPEARMAN,
        }

    def predict_b29(self) -> dict:
        """
        Generate a 72-hour diesel forecast for 4 B29 corridor clusters.
        Uses the trained model if available; falls back to persistence otherwise.
        """
        artifact, df = self._load_b29()
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        model_available = artifact is not None

        if model_available:
            feat_df = _build_features(df.iloc[-200:])
            last_row = feat_df.iloc[[-1]]
            feature_cols = artifact["feature_columns"]
            X = last_row[feature_cols]  # DataFrame

            model    = artifact["model"]
            scaler_X = artifact["scaler_X"]
            scaler_y = artifact["scaler_y"]

            y_scaled = model.predict(scaler_X.transform(X))
            y_pred   = scaler_y.inverse_transform(y_scaled)[0]
            target_cols = artifact["target_columns"]

            # Build per-cluster forecast {cluster_name: {h: price}}
            forecasts: dict[str, dict[int, float]] = {k: {} for k in B29_CLUSTER_META}
            for i, col_name in enumerate(target_cols):
                parts = col_name.rsplit("_t+", 1)
                if len(parts) != 2:
                    continue
                cluster_key = parts[0].replace("diesel_", "")  # e.g. "Aalen"
                horizon_h = int(parts[1].rstrip("h"))
                if cluster_key in forecasts:
                    forecasts[cluster_key][horizon_h] = float(round(y_pred[i], 4))

            clusters_out = []
            for cluster_name, meta in B29_CLUSTER_META.items():
                col = f"diesel_{cluster_name}"
                current_price = float(round(df[col].iloc[-1], 4))
                forecast_list = [
                    {"hour_offset": h,
                     "predicted_price": forecasts[cluster_name].get(h, current_price)}
                    for h in range(1, 73)
                ]
                clusters_out.append({
                    "id":            cluster_name.lower().replace(" ", "_").replace("ä", "a").replace("ü", "u"),
                    "label":         cluster_name,
                    "color":         meta["color"],
                    "current_price": current_price,
                    "forecast":      forecast_list,
                })
        else:
            # Persistence fallback: use last 72h of parquet as "expected continuation"
            clusters_out = []
            for cluster_name, meta in B29_CLUSTER_META.items():
                col = f"diesel_{cluster_name}"
                if col not in df.columns:
                    # Try alternate spellings
                    matches = [c for c in df.columns if cluster_name.lower() in c.lower()]
                    col = matches[0] if matches else df.columns[0]
                current_price = float(round(df[col].iloc[-1], 4))
                # Use prices from 1 week ago at the same hours as a seasonal naive forecast
                week_ago_slice = df[col].iloc[-72 - 168 : -168]
                forecast_list = []
                for h in range(1, 73):
                    idx = h - 1
                    if idx < len(week_ago_slice):
                        pred = float(round(week_ago_slice.iloc[idx], 4))
                    else:
                        pred = current_price
                    forecast_list.append({"hour_offset": h, "predicted_price": pred})
                clusters_out.append({
                    "id":            cluster_name.lower().replace(" ", "_").replace("ä", "a").replace("ü", "u"),
                    "label":         cluster_name,
                    "color":         meta["color"],
                    "current_price": current_price,
                    "forecast":      forecast_list,
                })

        # Recommendations
        recommendations = []
        for c_out in clusters_out:
            best = min(c_out["forecast"], key=lambda f: f["predicted_price"])
            optimal_dt = now + timedelta(hours=best["hour_offset"])
            recommendations.append({
                "cluster":              c_out["label"],
                "cluster_id":           c_out["id"],
                "current_price":        c_out["current_price"],
                "predicted_best_price": best["predicted_price"],
                "optimal_hour_offset":  best["hour_offset"],
                "optimal_time_label":   f"{optimal_dt.strftime('%d.%m. %H:%M')} Uhr",
                "savings_vs_now":       round(c_out["current_price"] - best["predicted_price"], 4),
            })
        recommendations.sort(key=lambda r: r["current_price"])

        model_info = {
            "name":                 "B29 Fleet MLP",
            "architecture":         "80→[256,128]→288",
            "mae":                  0.031,
            "mae_improvement_pct":  23.0,
            "r2":                   0.93,
        } if model_available else {
            "name":         "B29 Persistence (Saisonale Naive-Prognose)",
            "architecture": "Kein Modell — run b29_fleet_mlp.ipynb",
            "mae":          None,
            "mae_improvement_pct": None,
            "r2":           None,
        }

        return {
            "ok":             True,
            "generated_at":   now.isoformat(),
            "data_source":    "parquet" + (" + b29_mlp.joblib" if model_available else " (persistence fallback)"),
            "parquet_last":   str(df.index[-1]),
            "model_available": model_available,
            "model":          model_info,
            "savings":        {"per_day_eur": 187.50, "per_year_eur": 46875.0, "trucks": 25},
            "clusters":       clusters_out,
            "recommendations": recommendations,
            "mae_by_horizon": _B29_MAE_BY_HORIZON,
        }


    def _load_all_germany_combined(self) -> pd.DataFrame:
        """
        Load B29 + Spedition parquets and derive E5/E10 via fuel ratio.
        Returns a 27-column wide DataFrame (9 locations × 3 fuel types),
        matching the column structure used during all_germany model training.
        """
        if self._ag_df is not None:
            return self._ag_df

        b29_df = pd.read_parquet(B29_PARQUET)    # diesel_Aalen, diesel_Schwäbisch Gmünd, …
        sp_df  = pd.read_parquet(SPEDITION_PARQUET)  # diesel_Route_E, …

        diesel_df = b29_df.join(sp_df, how="inner")  # 9 diesel cols, aligned on timestamp

        frames = [diesel_df]
        for ft in ("e5", "e10"):
            ratio = _FUEL_RATIO[ft]
            ft_df = diesel_df.rename(
                columns={c: c.replace("diesel_", f"{ft}_") for c in diesel_df.columns}
            ) * ratio
            frames.append(ft_df)

        self._ag_df = pd.concat(frames, axis=1).sort_index()
        logger.info("[ml_service] All-Germany combined parquet: shape=%s, last=%s",
                    self._ag_df.shape, self._ag_df.index[-1])
        return self._ag_df

    def predict_all_germany(self, fuel_type: str) -> dict:
        """
        Run inference with a trained all-Germany model.
        Returns per-location 72h forecast in GeoViz station format.
        """
        model_path = ALL_GERMANY_MODELS.get(fuel_type)
        if not model_path or not model_path.exists():
            logger.warning("[ml_service] all_germany_%s_mlp.joblib not found.", fuel_type)
            return {"model_available": False, "fuel_type": fuel_type, "stations": []}

        import joblib
        art = joblib.load(model_path)
        wide = self._load_all_germany_combined()

        feat = _build_features_all_germany(wide.iloc[-300:])   # 300h > max lag 168h
        feature_cols = art["feature_columns"]
        last_row = feat.iloc[[-1]]
        # Align columns — only keep features the model knows
        X = last_row[[c for c in feature_cols if c in last_row.columns]]
        if X.shape[1] != len(feature_cols):
            missing = [c for c in feature_cols if c not in last_row.columns]
            logger.warning("[ml_service] %d feature columns missing from inference frame: %s…",
                           len(missing), missing[:3])
            return {"model_available": False, "fuel_type": fuel_type,
                    "error": f"{len(missing)} feature columns missing", "stations": []}

        y_pred = art["scaler_y"].inverse_transform(
            art["model"].predict(art["scaler_X"].transform(X))
        )[0]

        target_cols = art["target_columns"]  # e.g. "diesel_Aalen_t+1h"
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        # Locations present in this model's target columns
        prefix = f"{fuel_type}_"
        loc_set: set[str] = set()
        for col in target_cols:
            loc = col.replace(prefix, "").rsplit("_t+", 1)[0]
            loc_set.add(loc)

        # Build per-location forecast {loc: {h: price}}
        loc_forecast: dict[str, dict[int, float]] = {loc: {} for loc in loc_set}
        for i, col in enumerate(target_cols):
            parts = col.replace(prefix, "").rsplit("_t+", 1)
            if len(parts) != 2:
                continue
            loc, h_str = parts
            h = int(h_str.rstrip("h"))
            if loc in loc_forecast:
                loc_forecast[loc][h] = float(round(y_pred[i], 4))

        # Resolve lat/lng for each location
        def _loc_latlon(loc: str) -> tuple[float, float]:
            if loc in _B29_CENTROIDS:
                c = _B29_CENTROIDS[loc]
                return c["lat"], c["lng"]
            if loc in ROUTE_META:
                m = ROUTE_META[loc]
                return m["lat"], m["lng"]
            return 48.84, 10.09  # fallback: Aalen

        stations_out = []
        for loc in sorted(loc_set):
            lat, lng = _loc_latlon(loc)
            fcast = loc_forecast[loc]
            prices_list = [
                {
                    "timestamp": (now + timedelta(hours=h)).isoformat(),
                    "price":     fcast.get(h, fcast.get(1, 1.9)),
                }
                for h in range(1, 25)
            ]
            stations_out.append({
                "id":     f"ag_{loc.lower().replace(' ','_').replace('ä','a').replace('ü','u')}",
                "name":   loc,
                "brand":  "Grid",
                "lat":    lat,
                "lng":    lng,
                "prices": prices_list,
            })

        return {
            "model_available": True,
            "fuel_type":       fuel_type,
            "stations":        stations_out,
            "model":           {
                "name":         f"All-Germany {fuel_type.upper()} MLP",
                "architecture": art.get("architecture", "(128,64)"),
                "val_mae":      art.get("val_mae"),
            },
        }

    def get_geo_timeseries_real(
        self,
        fuel_type: str = "diesel",
        date: str | None = None,
        interval: str = "hour",
        scenario: str = "all",
    ) -> dict:
        """
        Return geo-temporal price data for the 3D map.

        scenario="all"       — All 15k German stations, 24h estimated prices
        scenario="spedition" — 5 Spedition route stations, MLP-predicted 24h prices
        scenario="b29"       — 4 B29 cluster centroids, MLP-predicted 24h prices
        scenario="germany"   — All-Germany grid model (falls back to "all" if not trained)
        """
        from datetime import date as date_cls

        ref_date = date_cls.fromisoformat(date) if date else datetime.now(timezone.utc).date()
        now_utc  = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

        # ── Spedition scenario ───────────────────────────────────────────────
        if scenario == "spedition":
            sp = self.predict_spedition()
            stations_out = []
            for s in sp["stations"]:
                route_key = s["route"]
                meta = ROUTE_META.get(route_key, {})
                # 24h timeseries from the 72h forecast
                prices_list = [
                    {
                        "timestamp": (now_utc + timedelta(hours=h)).isoformat(),
                        "price":     s["forecast"][h - 1]["predicted_price"] if h > 0 else s["current_price"],
                    }
                    for h in range(24)
                ]
                stations_out.append({
                    "id":    s["id"],
                    "name":  s["name"],
                    "brand": meta.get("name", s["name"]),
                    "lat":   meta.get("lat", 48.8),
                    "lng":   meta.get("lng", 10.1),
                    "route": route_key,
                    "color": meta.get("color", "#3b82f6"),
                    "prices": prices_list,
                })
            return {
                "ok": True,
                "stations": stations_out,
                "meta": {
                    "fuel_type": "diesel",
                    "date": str(ref_date),
                    "interval": "hour",
                    "n_stations": len(stations_out),
                    "scenario": "spedition",
                    "model_source": sp.get("data_source", "unknown"),
                },
            }

        # ── B29 cluster scenario ─────────────────────────────────────────────
        if scenario == "b29":
            b29 = self.predict_b29()
            stations_out = []
            for c in b29["clusters"]:
                cluster_name = c["label"]
                centroid = _B29_CENTROIDS.get(cluster_name, {"lat": 48.8, "lng": 10.0})
                prices_list = [
                    {
                        "timestamp": (now_utc + timedelta(hours=h)).isoformat(),
                        "price":     c["forecast"][h - 1]["predicted_price"] if h > 0 else c["current_price"],
                    }
                    for h in range(24)
                ]
                stations_out.append({
                    "id":     c["id"],
                    "name":   cluster_name,
                    "brand":  "Cluster",
                    "lat":    centroid["lat"],
                    "lng":    centroid["lng"],
                    "color":  c["color"],
                    "prices": prices_list,
                })
            return {
                "ok": True,
                "stations": stations_out,
                "meta": {
                    "fuel_type": "diesel",
                    "date": str(ref_date),
                    "interval": "hour",
                    "n_stations": len(stations_out),
                    "scenario": "b29",
                    "model_source": b29.get("data_source", "unknown"),
                    "model_available": b29.get("model_available", False),
                },
            }

        # ── All-Germany grid model scenario ──────────────────────────────────
        if scenario == "germany":
            ag = self.predict_all_germany(fuel_type)
            if ag.get("model_available"):
                return {
                    "ok":       True,
                    "stations": ag["stations"],
                    "meta": {
                        "fuel_type":       fuel_type,
                        "date":            str(ref_date),
                        "interval":        "hour",
                        "n_stations":      len(ag["stations"]),
                        "scenario":        "germany",
                        "model_available": True,
                        "model_name":      ag["model"]["name"],
                        "data_source":     "all_germany_mlp.joblib",
                    },
                }
            # Model not trained yet — fall through to "all" stations with notice
            logger.info("[ml_service] germany model not available, falling back to 'all' scenario.")

        # ── All stations ─────────────────────────────────────────────────────
        geo_df = self._load_stations_geo()
        recent_df = self._load_recent_prices(fuel_type)  # real data if available

        _, b29_df = self._load_b29()
        ratio = _FUEL_RATIO.get(fuel_type, 1.0)
        base_national = float(b29_df.mean(axis=1).iloc[-24:].mean()) * ratio

        current_weekday = now_utc.weekday()
        wd_off = _WEEKDAY_OFFSETS[current_weekday]

        using_real = recent_df is not None
        stations_out = []

        for _, row in geo_df.iterrows():
            uuid  = str(row["uuid"])
            brand = str(row.get("brand", ""))

            if using_real and uuid in recent_df.index:
                # Use real hourly prices from recent_prices parquet
                rp = recent_df.loc[uuid]
                prices_list = [
                    {
                        "timestamp": (datetime(ref_date.year, ref_date.month, ref_date.day,
                                               hour, 0, 0, tzinfo=timezone.utc)).isoformat(),
                        "price": round(max(1.0, float(rp.get(f"h{hour:02d}",
                                                             rp[[f"h{h:02d}" for h in range(24)
                                                                 if f"h{h:02d}" in rp]].mean()))), 3),
                    }
                    for hour in range(24)
                ]
            else:
                # Fallback: estimate from brand/seed/hour offsets
                b_off = _brand_offset(brand)
                h = int(hashlib.md5(f"{uuid}-{fuel_type}".encode()).hexdigest()[:6], 16)
                seed = (h % 81 - 40) / 1000.0
                base = round(base_national + b_off + seed + wd_off, 4)
                prices_list = [
                    {
                        "timestamp": (datetime(ref_date.year, ref_date.month, ref_date.day,
                                               hour, 0, 0, tzinfo=timezone.utc)).isoformat(),
                        "price": round(max(1.0, base + _HOUR_OFFSETS[hour]), 3),
                    }
                    for hour in range(24)
                ]

            stations_out.append({
                "id":     uuid,
                "name":   str(row.get("name", "")),
                "brand":  brand,
                "lat":    float(row["latitude"]),
                "lng":    float(row["longitude"]),
                "prices": prices_list,
            })

        return {
            "ok": True,
            "stations": stations_out,
            "meta": {
                "fuel_type":   fuel_type,
                "date":        str(ref_date),
                "interval":    "hour",
                "n_stations":  len(stations_out),
                "scenario":    scenario,
                "data_source": "recent_prices_7d.parquet (echte Daten)" if using_real
                               else "stations_geo.parquet + b29_parquet_estimate",
                "real_data":   using_real,
                "base_price":  round(base_national, 3),
            },
        }


# Module-level singleton
ml_service = MLService()


def _build_features_all_germany(df_wide: pd.DataFrame) -> pd.DataFrame:
    """
    Build a 519-column feature matrix from a 27-column wide hourly DataFrame
    (9 locations × 3 fuel types). Exact replica of build_features_all_germany()
    in scripts/data_transform_all_germany.py for web inference.
    """
    fuel_prefixes = ("diesel_", "e5_", "e10_")
    all_price_cols = [
        c for c in df_wide.columns
        if any(c.startswith(p) for p in fuel_prefixes)
    ]
    series: dict[str, pd.Series] = {}

    for col in all_price_cols:
        s = df_wide[col]

        for lag in LAG_HOURS:
            series[f"{col}_lag_{lag}h"] = s.shift(lag)

        series[f"{col}_price_t"] = s
        series[f"{col}_diff"]    = s - s.shift(1)

        for w in ROLLING_WINDOWS:
            series[f"{col}_roll_mean_{w}h"] = s.rolling(w, min_periods=w).mean()
            series[f"{col}_roll_std_{w}h"]  = s.rolling(w, min_periods=w).std()

        series[f"{col}_trend"]    = _rolling_linear_slope(s, TREND_WINDOW)
        series[f"{col}_momentum"] = s.shift(1) - s.shift(24)

    idx = df_wide.index
    series["hour_sin"]   = pd.Series(np.sin(2 * np.pi * idx.hour / 24),     index=idx)
    series["hour_cos"]   = pd.Series(np.cos(2 * np.pi * idx.hour / 24),     index=idx)
    series["dow_sin"]    = pd.Series(np.sin(2 * np.pi * idx.dayofweek / 7), index=idx)
    series["dow_cos"]    = pd.Series(np.cos(2 * np.pi * idx.dayofweek / 7), index=idx)
    series["is_weekend"] = pd.Series((idx.dayofweek >= 5).astype(np.int8),  index=idx)
    series["is_holiday"] = _is_holiday(idx).astype(np.int8)

    return pd.DataFrame(series, index=idx)


def get_diesel_price_history(days: int = 30) -> dict:
    """
    Return daily average diesel prices for the past `days` days from the B29 parquet.
    Response shape matches mock_data.get_price_history() exactly.
    """
    _, df = ml_service._load_b29()
    daily = df.resample("D").mean()
    tail = daily.iloc[-(days + 1):]
    data = []
    for ts, row in tail.iterrows():
        avg = float(row.mean())
        low = float(row.min())
        high = float(row.max())
        data.append({
            "timestamp": ts.isoformat(),
            "price": round(avg, 3),
            "min": round(low, 3),
            "max": round(high, 3),
            "station_count": 4,  # 4 B29 cluster means
        })
    return {"ok": True, "fuel_type": "diesel", "data": data}


def get_heatmap_from_parquet(fuel_type: str) -> dict:
    """
    Build a 7×24 price heatmap from the real B29 hourly parquet.
    Uses the most recent 365 days so prices reflect current market levels.
    Returns the same JSON shape as mock_data.get_heatmap_data().
    For E5/E10 applies a ratio to the diesel pattern.
    """
    _, df = ml_service._load_b29()
    ratio = _FUEL_RATIO[fuel_type]

    # Use only the last 90 days so prices reflect current market levels (not 12-year average)
    df_recent = df.iloc[-90 * 24:]

    # Hourly mean across all 4 clusters
    price_series = df_recent.mean(axis=1) * ratio

    # Build a temporary DataFrame with weekday/hour indices
    tmp = pd.DataFrame({
        "price": price_series,
        "weekday": price_series.index.dayofweek,
        "hour": price_series.index.hour,
    })

    grouped = tmp.groupby(["weekday", "hour"])["price"].mean()
    overall_avg = float(grouped.mean())

    cells = []
    for (weekday, hour), avg in grouped.items():
        cells.append({
            "hour":      int(hour),
            "weekday":   int(weekday),
            "avg_price": round(float(avg), 3),
            "relative":  round(float(avg) - overall_avg, 3),
        })

    return {
        "ok":          True,
        "fuel_type":   fuel_type,
        "overall_avg": round(overall_avg, 3),
        "data":        cells,
    }


def get_short_term_forecast(fuel_type: str, hours: int = 72) -> dict:
    """
    72h forecast built from parquet current price + heatmap seasonal pattern.
    Uses the per-hour relative deviation from get_heatmap_from_parquet() to
    project a realistic curve at real market price levels (~2.0 EUR/L).
    Not a trained ML model — seasonal naive with real base price.
    """
    hm = get_heatmap_from_parquet(fuel_type)
    base = hm["overall_avg"]
    dev_by_slot: dict[tuple[int, int], float] = {
        (cell["weekday"], cell["hour"]): cell["relative"]
        for cell in hm["data"]
    }
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    forecast = []
    for h in range(hours):
        ts = now + timedelta(hours=h)
        dev = dev_by_slot.get((ts.weekday(), ts.hour), 0.0)
        price = round(base + dev, 3)
        forecast.append({
            "timestamp":       ts.isoformat(),
            "predicted_price": price,
            "lower":           round(price - 0.012, 3),
            "upper":           round(price + 0.012, 3),
        })
    return {
        "ok":            True,
        "fuel_type":     fuel_type,
        "current_price": round(base, 3),
        "data_source":   "b29_parquet_seasonal",
        "forecast":      forecast,
    }


def get_best_time_from_parquet(fuel_type: str) -> dict:
    """
    Compute best/worst fueling time from real parquet data.
    Returns the same JSON shape as mock_data.get_best_time().
    """
    result = get_heatmap_from_parquet(fuel_type)
    cells = result["data"]
    overall_avg = result["overall_avg"]

    best  = min(cells, key=lambda c: c["avg_price"])
    worst = max(cells, key=lambda c: c["avg_price"])
    savings = round(worst["avg_price"] - best["avg_price"], 3)

    insight = (
        f"{_DAY_NAMES_DE[best['weekday']]}s zwischen {best['hour']}:00 und {best['hour']+1}:00 Uhr "
        f"sind die Preise am günstigsten ({best['avg_price']:.3f} EUR/L)."
    )
    return {
        "ok":                      True,
        "fuel_type":               fuel_type,
        "best_hour":               best["hour"],
        "best_weekday":            best["weekday"],
        "avg_price_best":          best["avg_price"],
        "avg_price_worst":         worst["avg_price"],
        "avg_price_overall":       overall_avg,
        "potential_savings_eur":   savings,
        "potential_savings_percent": round(savings / overall_avg * 100, 2),
        "insight":                 insight,
    }
