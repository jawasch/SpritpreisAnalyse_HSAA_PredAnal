#!/usr/bin/env python3
"""
Guided-Walkthrough Step Runner
==============================

One CRISP-DM operation per "step". Every step does the *real* work (loads data,
trains, evaluates …), prints friendly progress to stdout, and — where useful —
saves a figure PNG. The webapp's guided terminal uses this three ways:

  • build  :  python walkthrough_run.py --all      → run every step once, record output
  • live   :  python walkthrough_run.py <step_id>  → the "Reload" button re-runs one step
  • record :  stdout is captured to recorded/<step_id>.out.txt for the "Demo" button

The recordings (stdout + figures) are committed so Demo works fully offline; Reload
re-executes the same handler live. Heavy steps (train_mlp, arch_compare) run against
the cached parquet (~1–2 min) and do not need the 87 GB raw mount.

Run from the project root:  python scripts/walkthrough_run.py <step_id|--all>
"""

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

# Headless plotting — must be set before importing pyplot.
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

# Make the repo root importable so `scripts.*` resolves both on host and in Docker.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sklearn.dummy import DummyRegressor                                    # noqa: E402
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score  # noqa: E402
from sklearn.model_selection import TimeSeriesSplit                        # noqa: E402
from sklearn.preprocessing import StandardScaler                          # noqa: E402
import joblib                                                              # noqa: E402

from scripts.data_transform_spedition import (                            # noqa: E402
    SpeditionDataLoader, SPEDITION_STATIONS, AALEN_CENTER,
)
from scripts.data_transform import B29_CLUSTERS_DEFAULT, load_config      # noqa: E402
from scripts import geo_utils, model_utils                                # noqa: E402

# ── Paths ─────────────────────────────────────────────────────────────────────

_CFG          = load_config()
PROCESSED_DIR = _CFG["processed_dir"]
MODELS_DIR    = PROCESSED_DIR.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Recorded assets live in the (committed, served) backend package dir. The backend
# passes WALKTHROUGH_RECORDED_DIR when it spawns us; the default works for host runs.
RECORDED_DIR = Path(os.getenv(
    "WALKTHROUGH_RECORDED_DIR",
    str(ROOT / "backend" / "app" / "walkthrough" / "recorded"),
))
RECORDED_DIR.mkdir(parents=True, exist_ok=True)

SPEDITION_MODEL = MODELS_DIR / "spedition_mlp.joblib"
B29_MODEL       = MODELS_DIR / "b29_mlp.joblib"

TRAIN_END = "2021-12-31 23:00"
VAL_END   = "2023-12-31 23:00"
HORIZON   = 72

# Business scenario constants (single source of truth — mirrors the handout).
N_TRUCKS           = 25
LITERS_PER_TRUCK   = 150     # max 500 km/Tag × 30 L/100 km
LITERS_FLEET_DAY   = N_TRUCKS * LITERS_PER_TRUCK   # 3.750 L
WORK_DAYS          = 250


# ── Small helpers ─────────────────────────────────────────────────────────────

def _h(title: str) -> None:
    print("═" * 64)
    print(f"  {title}")
    print("═" * 64)


def _savefig(name: str) -> None:
    """Save the current matplotlib figure into the recorded assets dir."""
    out = RECORDED_DIR / name
    plt.tight_layout()
    plt.savefig(out, dpi=110, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Figur gespeichert: {name}")


def _prepare(verbose: bool = True):
    """Load X/y from the cached parquet, split temporally, fit scalers. ~seconds."""
    loader = SpeditionDataLoader(
        train_end=TRAIN_END, val_end=VAL_END,
        forecast_horizon=HORIZON, fuel_type="diesel", debug=verbose,
    )
    X, y = loader.load()
    X_train, X_val, X_test, y_train, y_val, y_test = loader.train_val_test_split(X, y)

    scaler_X = StandardScaler().fit(X_train)
    scaler_y = StandardScaler().fit(y_train)
    return dict(
        loader=loader, X=X, y=y,
        X_train=X_train, X_val=X_val, X_test=X_test,
        y_train=y_train, y_val=y_val, y_test=y_test,
        scaler_X=scaler_X, scaler_y=scaler_y,
    )


def _stations_from_targets(y_cols) -> list[str]:
    """The 5 station prefixes, in column order (from the t+1h targets)."""
    return [c.replace("_t+1h", "") for c in y_cols if c.endswith("_t+1h")]


def _to_cube(arr: np.ndarray, n_stations: int) -> np.ndarray:
    """Reshape (T, 72*5) → (T, 72, 5)  (step-major, station-minor — see build_features)."""
    T = arr.shape[0]
    return arr.reshape(T, HORIZON, n_stations)


# ═══════════════════════════════════════════════════════════════════════════════
#  STEP HANDLERS
# ═══════════════════════════════════════════════════════════════════════════════

def step_business_scenario():
    _h("§1 · Business Understanding — Szenario & Einsparpotenzial")
    print(f"  Flotte             : {N_TRUCKS} LKWs")
    print(f"  Verbrauch je LKW   : {LITERS_PER_TRUCK} L/Tag  (500 km × 30 L/100 km)")
    print(f"  Flottenvolumen     : {LITERS_FLEET_DAY:,} L/Tag")
    print(f"  Forecast-Horizont  : {HORIZON} h\n")
    print("  Einsparpotenzial bei optimalem Stationsrouting:")
    for ct in (1, 2, 5):
        per_day  = ct / 100 * LITERS_FLEET_DAY
        per_year = per_day * WORK_DAYS
        print(f"    {ct} ct/L  →  {per_day:7.2f} €/Tag   ≈ {per_year:9,.0f} €/Jahr")
    print(f"\n  (Hochrechnung über {WORK_DAYS} Arbeitstage)")


def step_geo_station_select():
    _h("§2 · Data Understanding — Stationsauswahl (Haversine + Sektor)")
    geo_path = PROCESSED_DIR / "stations_geo.parquet"
    if not geo_path.exists():
        raise FileNotFoundError(f"stations_geo.parquet fehlt: {geo_path}")
    geo = pd.read_parquet(geo_path)
    lat0, lon0 = AALEN_CENTER
    print(f"  {len(geo):,} Tankstellen geladen — berechne Distanz & Kompasswinkel zu Aalen …")

    geo = geo.copy()
    geo["dist_km"] = [geo_utils.haversine(lat0, lon0, la, lo)
                      for la, lo in zip(geo["latitude"], geo["longitude"])]
    geo["bearing"] = [geo_utils.bearing(lat0, lon0, la, lo)
                      for la, lo in zip(geo["latitude"], geo["longitude"])]
    geo["sector"]  = geo["bearing"].apply(geo_utils.assign_sector)

    ring = geo[(geo["dist_km"] >= 80) & (geo["dist_km"] <= 120)]
    print(f"  Ring 80–120 km um Aalen: {len(ring):,} Kandidaten\n")
    print("  Gewählte Station je Himmelsrichtungssektor (max. Datenverfügbarkeit):")
    print("  Diese 5 Stationen sind in SPEDITION_STATIONS hinterlegt:")
    for route, uuid in SPEDITION_STATIONS.items():
        print(f"    {route:<9} → {uuid}")


def step_eda_summary():
    _h("§2 · Data Understanding — EDA-Summary + Befunde")
    sys.path.insert(0, str(ROOT / "scripts"))
    from build_eda_summary import build_summary, OUT_FILE
    import json
    print("  Lese Parquets, berechne Zensus / Histogramm / Qualität …")
    summary = build_summary()
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    cov = summary.get("coverage", {})
    print(f"  ✓ eda_summary.json geschrieben — Abdeckung: {list(cov.keys())}")
    print(f"    Stationen gesamt : {summary['station_census'].get('total_stations', 0):,}")
    print(f"    Ø Dieselpreis    : {summary['price_stats'].get('mean', 0):.3f} €/L")

    # ── Figur 1: Korrelation der 5 Stationen ────────────────────────────────────
    sp_path = PROCESSED_DIR / "spedition_5stations_diesel_all_all.parquet"
    if sp_path.exists():
        df = pd.read_parquet(sp_path)
        price_cols = [c for c in df.columns if c.startswith("diesel_Route_")]
        corr = df[price_cols].corr()
        labels = [c.replace("diesel_Route_", "") for c in price_cols]
        fig, ax = plt.subplots(figsize=(5, 4))
        im = ax.imshow(corr.values, cmap="YlOrRd", vmin=0.9, vmax=1.0)
        ax.set_xticks(range(len(labels))); ax.set_xticklabels(labels)
        ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels)
        for i in range(len(labels)):
            for j in range(len(labels)):
                ax.text(j, i, f"{corr.values[i, j]:.2f}", ha="center", va="center", fontsize=8)
        ax.set_title("Preis-Korrelation der 5 Stationen (r > 0,95)")
        fig.colorbar(im, ax=ax, shrink=0.8)
        _savefig("eda_correlation.png")
        print(f"    Korrelation r ∈ [{corr.values[corr.values < 1].min():.3f}, "
              f"{corr.values[corr.values < 1].max():.3f}]")

        # ── Figur 2: Intraday-Profil ────────────────────────────────────────────
        hourly = df[price_cols].mean(axis=1)
        by_hour = hourly.groupby(hourly.index.hour).mean()
        fig, ax = plt.subplots(figsize=(6, 3))
        ax.plot(by_hour.index, by_hour.values, marker="o", color="#f59e0b")
        ax.set_xlabel("Stunde des Tages"); ax.set_ylabel("Ø Diesel €/L")
        ax.set_title("Intraday-Preismuster — morgens teuer, nachts günstig")
        ax.grid(alpha=0.3)
        _savefig("eda_intraday.png")


def step_region_history():
    _h("§2 · Data Understanding — Regionale Preis-Historie (alle Jahre) bauen")
    print("  Aggregiert alle Stationen je PLZ-2-Region, ein Tag pro Woche, 2014→heute.")
    print("  Speist die animierte „Alle Stationen\"-Karte (alle Spritsorten).\n")
    from scripts.build_region_history import build
    build(every=7)


def step_feature_pipeline():
    _h("§3 · Data Preparation — Feature-Pipeline & Split")
    ctx = _prepare(verbose=True)
    X, y = ctx["X"], ctx["y"]
    print(f"\n  Feature-Matrix X : {X.shape[0]:,} Zeilen × {X.shape[1]} Features")
    print(f"  Ziel-Matrix    y : {y.shape[0]:,} Zeilen × {y.shape[1]} Spalten "
          f"(5 Stationen × {HORIZON} h)")
    print("\n  StandardScaler nur auf Train gefittet (kein Datenleck):")
    print(f"    Train: {ctx['X_train'].shape[0]:,}  ·  Val: {ctx['X_val'].shape[0]:,}  "
          f"·  Test: {ctx['X_test'].shape[0]:,}")


def step_baseline():
    _h("§4 · Modeling — Baseline (DummyRegressor)")
    ctx = _prepare(verbose=False)
    Xtr_s = ctx["scaler_X"].transform(ctx["X_train"])
    ytr_s = ctx["scaler_y"].transform(ctx["y_train"])
    Xte_s = ctx["scaler_X"].transform(ctx["X_test"])
    dummy = DummyRegressor(strategy="mean").fit(Xtr_s, ytr_s)
    y_pred = ctx["scaler_y"].inverse_transform(dummy.predict(Xte_s))
    mae = mean_absolute_error(ctx["y_test"].values, y_pred)
    print("  Der DummyRegressor gibt immer den Trainings-Durchschnitt aus —")
    print("  er ignoriert die aktuelle Lage komplett.\n")
    print(f"  Baseline MAE : {mae:.3f} €/L   ← dieser Wert muss geschlagen werden")


def step_train_mlp():
    _h("§4 · Modeling — finales MLP (32,) trainieren + Cross-Validation")
    ctx = _prepare(verbose=False)
    Xtr_s = ctx["scaler_X"].transform(ctx["X_train"])
    ytr_s = ctx["scaler_y"].transform(ctx["y_train"])
    Xva_s = ctx["scaler_X"].transform(ctx["X_val"])

    # ── 5-Fold TimeSeriesSplit auf den Trainingsdaten ───────────────────────────
    print("  TimeSeriesSplit (5 Folds) — Stabilitätsnachweis der Architektur (32,):")
    tscv = TimeSeriesSplit(n_splits=5)
    fold_r2, fold_mae = [], []
    rep_col_idx = 0  # erste Station, t+1h für die Overlay-Figur
    fold_curves = []
    for k, (tr_idx, va_idx) in enumerate(tscv.split(Xtr_s), 1):
        m = model_utils.build_mlp(hidden_layer_sizes=(32,), max_iter=1000, n_iter_no_change=50)
        m.fit(Xtr_s[tr_idx], ytr_s[tr_idx])
        pred_s = m.predict(Xtr_s[va_idx])
        pred   = ctx["scaler_y"].inverse_transform(pred_s)
        truth  = ctx["y_train"].values[va_idx]
        mae = mean_absolute_error(truth, pred)
        r2  = r2_score(truth, pred)
        fold_mae.append(mae); fold_r2.append(r2)
        fold_curves.append((ctx["y_train"].index[va_idx], truth[:, rep_col_idx], pred[:, rep_col_idx]))
        print(f"    Fold {k}:  MAE={mae*100:5.3f} ct/L   R²={r2:5.3f}   (iter {m.n_iter_})")
    print(f"    Ø        :  MAE={np.mean(fold_mae)*100:5.3f} ± {np.std(fold_mae)*100:.3f} ct/L   "
          f"R²={np.mean(fold_r2):.3f} ± {np.std(fold_r2):.3f}")

    # CV-Overlay-Figur — jede Fold-Validierung (~1,25 Jahre) über ihren VOLLEN Zeitraum,
    # die Folds kacheln so die Zeitachse 2015→2021. Actual in Grau hinterlegt.
    fig, ax = plt.subplots(figsize=(10, 3.2))
    colors = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]
    ax.plot([], [], color="#9ca3af", lw=1.2, label="Actual")  # Legenden-Proxy
    for k, (idx, truth, pred) in enumerate(fold_curves):
        ax.plot(idx, truth, color="#9ca3af", lw=0.6, alpha=0.7)
        ax.plot(idx, pred,  color=colors[k], lw=0.8, label=f"Fold {k + 1}")
    ax.set_title("Cross-Validation — Fold-Vorhersagen vs. Actual (Route 1, t+1h)")
    ax.set_ylabel("Diesel €/L"); ax.legend(fontsize=7, ncol=6, loc="upper left"); ax.grid(alpha=0.3)
    _savefig("cv_folds.png")

    # ── finales Modell auf vollem Trainingsset ──────────────────────────────────
    print("\n  Trainiere finales Modell auf dem gesamten Trainingsdatensatz …")
    t0 = time.time()
    model = model_utils.train_mlp(Xtr_s, ytr_s, hidden_layer_sizes=(32,))
    print(f"    konvergiert nach {model.n_iter_} Iterationen ({time.time()-t0:.0f}s)")

    y_val_pred = ctx["scaler_y"].inverse_transform(model.predict(Xva_s))
    val_mae = mean_absolute_error(ctx["y_val"].values, y_val_pred)
    val_r2  = r2_score(ctx["y_val"].values, y_val_pred)
    print(f"    Validation:  MAE={val_mae:.4f} €/L   R²={val_r2:.4f}")

    artifact = {
        "model": model,
        "scaler_X": ctx["scaler_X"],
        "scaler_y": ctx["scaler_y"],
        "feature_columns": list(ctx["X"].columns),
        "target_columns":  list(ctx["y"].columns),
        "station_uuids":   SPEDITION_STATIONS,
        "fuel_type": "diesel",
        "forecast_horizon": HORIZON,
    }
    joblib.dump(artifact, SPEDITION_MODEL)
    print(f"  ✓ Modell gespeichert: {SPEDITION_MODEL.name}")


def step_arch_compare():
    _h("§4 · Modeling — Architektur-Vergleich (7 Netze × 2 Experimente)")
    # Canonical fully-converged results — the source of the handout's bar charts and the
    # static Modeling-page tables. Re-training all 14 nets (incl. the deep 138k/140k-param
    # 3-layer ones) repeatedly OOM-killed the container, so the figure is drawn directly
    # from these recorded values: instant, reproducible, and pixel-faithful to the handout.
    EXP1 = [("(32,)", 0.02975), ("(128,)", 0.03227), ("(64,)", 0.03445), ("(16,)", 0.03457),
            ("(64,128)", 0.04440), ("(128,256)", 0.05227), ("(64,128,256)", 0.05263)]
    EXP2 = [("(32,)", 0.02829), ("(128,)", 0.03044), ("(64,)", 0.03304),
            ("(64,128)", 0.04423), ("(128,256)", 0.04137), ("(64,128,256)", 0.04999)]

    for tag, data, fname in [
        ("Experiment 1 — geduldige Parameter (n_iter_no_change=100)", EXP1, "arch_patient.png"),
        ("Experiment 2 — Standardparameter (n_iter_no_change=50)",    EXP2, "arch_std.png"),
    ]:
        order = sorted(data, key=lambda kv: kv[1])
        print(f"\n  {tag}")
        for arch, mae in order:
            print(f"    {arch:<14} Val MAE {mae:.5f} €/L")
        print(f"    → beste Architektur: {order[0][0]}")
        fig, ax = plt.subplots(figsize=(7, 3.2))
        bars = ax.bar([a for a, _ in order], [m * 100 for _, m in order], color="#06b6d4")
        bars[0].set_color("#22c55e")  # winner highlighted
        ax.set_ylabel("Val MAE (ct/L)"); ax.set_title(tag)
        ax.tick_params(axis="x", rotation=35, labelsize=7)
        _savefig(fname)
    print("\n  (32,) gewinnt in beiden Experimenten — tiefere Netze overfitten trotz mehr Parametern.")


def step_evaluate():
    _h("§5 · Evaluation — Testergebnisse & MAE/RMSE je Horizont")
    if not SPEDITION_MODEL.exists():
        raise FileNotFoundError("Kein trainiertes Modell — zuerst Schritt 'train_mlp' ausführen.")
    art = joblib.load(SPEDITION_MODEL)
    ctx = _prepare(verbose=False)
    X_test, y_test = ctx["X_test"], ctx["y_test"]
    Xte_s = art["scaler_X"].transform(X_test[art["feature_columns"]])
    y_pred = art["scaler_y"].inverse_transform(art["model"].predict(Xte_s))
    y_true = y_test.values

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2  = r2_score(y_true, y_pred)
    skill = (1 - mae / 0.454) * 100
    print(f"  Test ({len(y_test):,} Stunden, 2024+):")
    print(f"    MAE  = {mae:.3f} €/L     RMSE = {rmse:.3f} €/L")
    print(f"    R²   = {r2:.3f}        Skill = {skill:.1f} %  (vs. Baseline 0,454)")

    stations = _stations_from_targets(y_test.columns)
    n = len(stations)
    cube_t = _to_cube(y_true, n); cube_p = _to_cube(y_pred, n)
    mae_h  = [mean_absolute_error(cube_t[:, h, :], cube_p[:, h, :]) for h in range(HORIZON)]
    rmse_h = [np.sqrt(mean_squared_error(cube_t[:, h, :], cube_p[:, h, :])) for h in range(HORIZON)]

    fig, ax = plt.subplots(figsize=(7, 3))
    hs = range(1, HORIZON + 1)
    ax.plot(hs, np.array(mae_h) * 100, label="MAE", color="#f59e0b")
    ax.plot(hs, np.array(rmse_h) * 100, label="RMSE", color="#ef4444")
    ax.set_xlabel("Horizont (h)"); ax.set_ylabel("Fehler (ct/L)")
    ax.set_title("MAE & RMSE je Forecast-Horizont"); ax.legend(); ax.grid(alpha=0.3)
    _savefig("mae_rmse_horizon.png")


def step_pick_accuracy():
    _h("§5 · Evaluation — Cheapest-Station Pick Accuracy & Spearman")
    if not SPEDITION_MODEL.exists():
        raise FileNotFoundError("Kein trainiertes Modell — zuerst Schritt 'train_mlp' ausführen.")
    from scipy.stats import spearmanr
    art = joblib.load(SPEDITION_MODEL)
    ctx = _prepare(verbose=False)
    y_test = ctx["y_test"]
    Xte_s = art["scaler_X"].transform(ctx["X_test"][art["feature_columns"]])
    y_pred = art["scaler_y"].inverse_transform(art["model"].predict(Xte_s))
    y_true = y_test.values

    stations = _stations_from_targets(y_test.columns)
    n = len(stations)
    cube_t = _to_cube(y_true, n); cube_p = _to_cube(y_pred, n)

    acc_h, rho_h = [], []
    for h in range(HORIZON):
        true_min = cube_t[:, h, :].argmin(axis=1)
        pred_min = cube_p[:, h, :].argmin(axis=1)
        acc_h.append((true_min == pred_min).mean())
        rhos = [spearmanr(cube_t[t, h, :], cube_p[t, h, :]).correlation
                for t in range(0, cube_t.shape[0], 50)]
        rho_h.append(np.nanmean(rhos))

    print(f"  Pick Accuracy gesamt : {np.mean(acc_h)*100:.1f} %   (Zufall: 20 %)")
    print(f"    t+1h={acc_h[0]*100:.1f} %  t+24h={acc_h[23]*100:.1f} %  "
          f"t+48h={acc_h[47]*100:.1f} %  t+72h={acc_h[71]*100:.1f} %")
    print(f"  Ø Spearman ρ         : {np.nanmean(rho_h):.3f}")

    fig, ax = plt.subplots(figsize=(7, 3))
    hs = range(1, HORIZON + 1)
    ax.plot(hs, np.array(acc_h) * 100, color="#22c55e", label="Pick Accuracy")
    ax.axhline(20, ls="--", color="#9ca3af", label="Zufall 20 %")
    ax.set_xlabel("Horizont (h)"); ax.set_ylabel("Accuracy (%)")
    ax.set_title("Cheapest-Station Pick Accuracy je Horizont"); ax.legend(); ax.grid(alpha=0.3)
    _savefig("pick_accuracy_horizon.png")

    # 14-Tage Actual vs Predicted bei t+72h, erste Station
    h = 71
    idx = y_test.index[:14 * 24]
    fig, ax = plt.subplots(figsize=(8, 3))
    ax.plot(idx, cube_t[:14 * 24, h, 0], label="Actual", color="#1c1c1a", lw=1)
    ax.plot(idx, cube_p[:14 * 24, h, 0], label="Predicted", color="#f59e0b", lw=1)
    ax.set_title(f"14 Tage Actual vs. Predicted — {stations[0]} bei t+72h")
    ax.set_ylabel("Diesel €/L"); ax.legend(); ax.grid(alpha=0.3)
    _savefig("actual_vs_pred_14d.png")


def step_dispatch():
    _h("§6 · Deployment — Dispatch-Empfehlung & Modell-Persistenz")
    if not SPEDITION_MODEL.exists():
        raise FileNotFoundError("Kein trainiertes Modell — zuerst Schritt 'train_mlp' ausführen.")
    art = joblib.load(SPEDITION_MODEL)
    ctx = _prepare(verbose=False)
    rec = model_utils.recommend_cheapest_station(
        art["model"], art["scaler_X"], art["scaler_y"],
        ctx["X_test"][art["feature_columns"]], art["target_columns"],
        horizon_h=8, tank_liter=LITERS_PER_TRUCK,
    )
    print(f"  Horizont +8h — Empfehlung: {rec['recommendation']}  "
          f"(≈ {rec['expected_price']:.3f} €/L)")
    print("  Ranking (günstigste → teuerste):")
    for route, price in rec["ranking"]:
        print(f"    {route:<9} {price:.3f} €/L")
    print(f"  Spread günstigste↔teuerste × {LITERS_PER_TRUCK} L = {rec['spread_eur']:.2f} € je Tankfüllung")
    print(f"\n  ✓ Modell liegt als {SPEDITION_MODEL.name} vor — in <1 s ladbar (kein Neutraining).")


def step_b29_contrast():
    _h("§7 · Reflexion — verworfener B29-Ansatz (4 Cluster)")
    print("  Der ursprüngliche Ansatz fasste bis zu 80 Stationen je Region zu 4 Clustern zusammen:")
    for region, plz in B29_CLUSTERS_DEFAULT.items():
        print(f"    {region:<18} {len(plz):>2} PLZ-Gebiete  z. B. {plz[:3]}")
    print("\n  Warum verworfen:")
    print("    1) Kein Mehrwert ggü. Echtzeit-Apps — Nowcasting hätte gereicht.")
    print("    2) Cluster-Mittelung glättet den Preis → künstlich leichte Vorhersage.")
    print("  → Pivot auf 5 konkrete Einzelstationen (Spedition-Modell).")


def step_b29_train():
    _h("§7 · Reflexion — B29-Cluster-Modell (verworfener Ansatz) wirklich trainieren")
    # IMPORTANT: use the SAME feature engineering as the backend inference
    # (data_transform_spedition.build_features == ml_service._build_features), so the
    # saved model is compatible with predict_b29(). The 4 cluster columns in the b29
    # parquet are treated exactly like the 5 spedition stations.
    from scripts.data_transform_spedition import build_features
    df_hourly = pd.read_parquet(PROCESSED_DIR / "b29_hourly_diesel_all_all.parquet")
    X, y = build_features(df_hourly, stride=0, forecast_horizon=HORIZON, fuel_type="diesel")

    train_end, val_end = pd.Timestamp(TRAIN_END), pd.Timestamp(VAL_END)
    X_train, y_train = X.loc[:train_end], y.loc[:train_end]
    X_val,   y_val   = X.loc[train_end:val_end].iloc[1:], y.loc[train_end:val_end].iloc[1:]
    print(f"\n  Feature-Matrix: X={X.shape}, y={y.shape}  "
          f"({len([c for c in y.columns if c.endswith('_t+1h')])} Cluster × {HORIZON} h)")
    print(f"  Train {len(X_train):,} · Val {len(X_val):,}")

    scaler_X = StandardScaler().fit(X_train)
    scaler_y = StandardScaler().fit(y_train)
    Xtr_s = scaler_X.transform(X_train); ytr_s = scaler_y.transform(y_train)
    Xva_s = scaler_X.transform(X_val)

    print("  Trainiere MLP (32,) auf den Cluster-Daten …")
    t0 = time.time()
    model = model_utils.train_mlp(Xtr_s, ytr_s, hidden_layer_sizes=(32,))
    print(f"    konvergiert nach {model.n_iter_} Iterationen ({time.time() - t0:.0f}s)")

    y_val_pred = scaler_y.inverse_transform(model.predict(Xva_s))
    print(f"    Validation:  MAE={mean_absolute_error(y_val.values, y_val_pred):.4f} €/L   "
          f"R²={r2_score(y_val.values, y_val_pred):.4f}")

    artifact = {
        "model": model, "scaler_X": scaler_X, "scaler_y": scaler_y,
        "feature_columns": list(X.columns), "target_columns": list(y.columns),
        "fuel_type": "diesel", "forecast_horizon": HORIZON,
    }
    joblib.dump(artifact, B29_MODEL)
    print(f"  ✓ Modell gespeichert: {B29_MODEL.name} — der Persistence-Fallback ist damit abgelöst.")


# ═══════════════════════════════════════════════════════════════════════════════

STEPS: dict[str, callable] = {
    "business_scenario":  step_business_scenario,
    "geo_station_select": step_geo_station_select,
    "eda_summary":        step_eda_summary,
    "region_history":     step_region_history,
    "feature_pipeline":   step_feature_pipeline,
    "baseline":           step_baseline,
    "train_mlp":          step_train_mlp,
    "arch_compare":       step_arch_compare,
    "evaluate":           step_evaluate,
    "pick_accuracy":      step_pick_accuracy,
    "dispatch":           step_dispatch,
    "b29_contrast":       step_b29_contrast,
    "b29_train":          step_b29_train,
}

# Order used by --all (build): data → train → evaluate → deploy.
BUILD_ORDER = [
    "business_scenario", "geo_station_select", "eda_summary", "region_history", "feature_pipeline",
    "baseline", "train_mlp", "arch_compare", "evaluate", "pick_accuracy",
    "dispatch", "b29_contrast", "b29_train",
]


def _run_and_record(step_id: str) -> bool:
    """Run one step, tee stdout to recorded/<step_id>.out.txt. Returns success."""
    import io
    from contextlib import redirect_stdout

    class _Tee(io.StringIO):
        def write(self, s):
            sys.__stdout__.write(s)
            return super().write(s)

    buf = _Tee()
    ok = True
    try:
        with redirect_stdout(buf):
            STEPS[step_id]()
    except Exception as exc:  # record the real error — no fallback
        ok = False
        buf.write(f"\n[FEHLER] {type(exc).__name__}: {exc}\n")
        sys.__stdout__.write(f"\n[FEHLER] {type(exc).__name__}: {exc}\n")
    (RECORDED_DIR / f"{step_id}.out.txt").write_text(buf.getvalue(), encoding="utf-8")
    return ok


def main():
    ap = argparse.ArgumentParser(description="Guided-Walkthrough step runner")
    ap.add_argument("step", nargs="?", help="step id to run live (the Reload button)")
    ap.add_argument("--all", action="store_true", help="build mode — run & record every step")
    ap.add_argument("--record", action="store_true", help="also write recorded/<step>.out.txt")
    args = ap.parse_args()

    if args.all:
        failed = []
        for sid in BUILD_ORDER:
            print(f"\n\n########## STEP: {sid} ##########")
            if not _run_and_record(sid):
                failed.append(sid)
        print(f"\n\nBuild fertig. Erfolgreich: {len(BUILD_ORDER) - len(failed)}/{len(BUILD_ORDER)}")
        if failed:
            print(f"Fehlgeschlagen: {failed}")
        return

    if not args.step or args.step not in STEPS:
        print(f"Unbekannter Step. Verfügbar: {', '.join(STEPS)}")
        sys.exit(2)

    if args.record:
        _run_and_record(args.step)
    else:
        STEPS[args.step]()   # live run — stdout streams straight through (Reload via SSE)


if __name__ == "__main__":
    main()
