"""
Build EDA summary JSON for the web dashboard's Datenexploration page.
Reads processed parquets (fast) — does NOT re-scan the 4k raw CSV files.

Run from project root:
    python scripts/build_eda_summary.py

Output: data/processed/eda_summary.json
"""
import json
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).parent.parent
PROCESSED    = PROJECT_ROOT / "data" / "processed"
OUT_FILE     = PROCESSED / "eda_summary.json"


def _load_b29() -> pd.DataFrame:
    p = PROCESSED / "b29_hourly_diesel_all_all.parquet"
    return pd.read_parquet(p) if p.exists() else pd.DataFrame()


def _load_spedition() -> pd.DataFrame:
    p = PROCESSED / "spedition_5stations_diesel_all_all.parquet"
    return pd.read_parquet(p) if p.exists() else pd.DataFrame()


def _load_stations_geo() -> pd.DataFrame:
    p = PROCESSED / "stations_geo.parquet"
    return pd.read_parquet(p) if p.exists() else pd.DataFrame()


def _price_cols(df: pd.DataFrame, fuel: str = "diesel") -> list[str]:
    return [c for c in df.columns if c.startswith(f"{fuel}_") and "_lag_" not in c
            and "_roll_" not in c and "_trend" not in c and "_momentum" not in c
            and "_diff" not in c and "_price_t" not in c]


def build_summary() -> dict:
    b29_df = _load_b29()
    sp_df  = _load_spedition()
    geo_df = _load_stations_geo()

    # ── Zeitabdeckung ──────────────────────────────────────────────────────────
    coverage = {}
    if not b29_df.empty:
        price_cols_b29 = _price_cols(b29_df)
        prices_b29 = b29_df[price_cols_b29] if price_cols_b29 else b29_df
        coverage["b29"] = {
            "start": str(prices_b29.index.min().date()),
            "end":   str(prices_b29.index.max().date()),
            "n_rows": int(len(prices_b29)),
            "n_clusters": len(price_cols_b29),
        }
    if not sp_df.empty:
        price_cols_sp = _price_cols(sp_df)
        prices_sp = sp_df[price_cols_sp] if price_cols_sp else sp_df
        coverage["spedition"] = {
            "start": str(prices_sp.index.min().date()),
            "end":   str(prices_sp.index.max().date()),
            "n_rows": int(len(prices_sp)),
            "n_stations": len(price_cols_sp),
        }

    # ── Stationen-Zensus ───────────────────────────────────────────────────────
    station_census = {}
    if not geo_df.empty:
        station_census = {
            "total_stations": int(len(geo_df)),
            "brands": geo_df["brand"].value_counts().head(15).to_dict()
            if "brand" in geo_df.columns else {},
        }

    # ── Preis-Statistik (B29 Diesel) ───────────────────────────────────────────
    price_stats = {}
    if not b29_df.empty and _price_cols(b29_df):
        pc = _price_cols(b29_df)
        series = b29_df[pc].values.flatten()
        series = series[~np.isnan(series)]
        series = series[series > 0.5]

        price_stats = {
            "mean":  float(round(np.mean(series), 4)),
            "std":   float(round(np.std(series), 4)),
            "min":   float(round(np.min(series), 4)),
            "max":   float(round(np.max(series), 4)),
            "p05":   float(round(np.percentile(series, 5), 4)),
            "p25":   float(round(np.percentile(series, 25), 4)),
            "p50":   float(round(np.percentile(series, 50), 4)),
            "p75":   float(round(np.percentile(series, 75), 4)),
            "p95":   float(round(np.percentile(series, 95), 4)),
        }

        # Histogramm (20 Bins) — clipped to realistic range to avoid outlier distortion
        HIST_MIN, HIST_MAX = 0.80, 3.50   # €/L — covers 99.9% of real data
        clipped = series[(series >= HIST_MIN) & (series <= HIST_MAX)]
        n_outliers_low  = int((series < HIST_MIN).sum())
        n_outliers_high = int((series > HIST_MAX).sum())
        hist, edges = np.histogram(clipped, bins=20, range=(HIST_MIN, HIST_MAX))
        price_stats["histogram"] = [
            {"bin_left": float(round(edges[i], 3)),
             "bin_right": float(round(edges[i+1], 3)),
             "count": int(hist[i])}
            for i in range(len(hist))
        ]
        price_stats["histogram_range"] = [HIST_MIN, HIST_MAX]
        price_stats["n_outliers_low"]  = n_outliers_low
        price_stats["n_outliers_high"] = n_outliers_high

    # ── Tagesverlauf Ø (Intraday-Profil) ──────────────────────────────────────
    intraday = []
    if not b29_df.empty and _price_cols(b29_df):
        pc = _price_cols(b29_df)
        prices_hourly = b29_df[pc].mean(axis=1)
        tmp = pd.DataFrame({"price": prices_hourly, "hour": prices_hourly.index.hour})
        by_hour = tmp.groupby("hour")["price"].mean()
        overall = float(by_hour.mean())
        intraday = [
            {"hour": int(h), "avg_price": float(round(p, 4)),
             "relative": float(round(p - overall, 4))}
            for h, p in by_hour.items()
        ]

    # ── Wöchentliches Preismuster (Weekday) ─────────────────────────────────────
    weekday_pattern = []
    if not b29_df.empty and _price_cols(b29_df):
        pc = _price_cols(b29_df)
        prices_hourly = b29_df[pc].mean(axis=1)
        tmp = pd.DataFrame({"price": prices_hourly, "dow": prices_hourly.index.dayofweek})
        by_dow = tmp.groupby("dow")["price"].mean()
        overall = float(by_dow.mean())
        names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
        weekday_pattern = [
            {"dow": int(d), "label": names[int(d)],
             "avg_price": float(round(p, 4)),
             "relative": float(round(p - overall, 4))}
            for d, p in by_dow.items()
        ]

    # ── Jährlicher Trend (monatliche Mittel) ──────────────────────────────────
    yearly_trend = []
    if not b29_df.empty and _price_cols(b29_df):
        pc = _price_cols(b29_df)
        prices_hourly = b29_df[pc].mean(axis=1)
        monthly = prices_hourly.resample("ME").mean().dropna()
        yearly_trend = [
            {"month": str(ts.date())[:7], "avg_price": float(round(p, 4))}
            for ts, p in monthly.items()
        ]

    # ── Ausreißer / Qualität ──────────────────────────────────────────────────
    quality = {}
    if not b29_df.empty and _price_cols(b29_df):
        pc = _price_cols(b29_df)
        all_vals = b29_df[pc].values
        n_total  = int(all_vals.size)
        n_nan    = int(np.isnan(all_vals).sum())
        n_zero   = int((all_vals == 0).sum())
        n_outlier_high = int((all_vals > 2.5).sum())
        n_outlier_low  = int(((all_vals > 0) & (all_vals < 0.8)).sum())
        quality = {
            "n_total_values":     n_total,
            "n_missing":          n_nan,
            "n_zero_prices":      n_zero,
            "n_outlier_high_250": n_outlier_high,
            "n_outlier_low_080":  n_outlier_low,
            "missing_pct":        float(round(n_nan / n_total * 100, 2)),
        }

    summary = {
        "generated_at": datetime.now().isoformat(),
        "coverage":      coverage,
        "station_census": station_census,
        "price_stats":   price_stats,
        "intraday_profile": intraday,
        "weekday_pattern":  weekday_pattern,
        "yearly_trend":     yearly_trend,
        "quality":           quality,
    }
    return summary


if __name__ == "__main__":
    print("Building EDA summary …")
    summary = build_summary()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"Written to {OUT_FILE}")
    print(f"  Coverage: {list(summary['coverage'].keys())}")
    print(f"  Stations: {summary['station_census'].get('total_stations', 'n/a')}")
    print(f"  Price stats: mean={summary['price_stats'].get('mean', 'n/a')} €/L")
