"""
Walkthrough API — the per-page "guided terminal".

Each CRISP-DM phase exposes a few *steps*. A step bundles:
  • a curated, commented code snippet (what the real operation looks like)
  • a minimal ELI5 line
  • the recorded stdout of a real run (for the offline "Demo" button)
  • any figure(s) the step's runner produced

Endpoints
  GET  /api/v1/walkthrough/{phase}        → steps for a phase (+ recorded stdout + figure urls)
  POST /api/v1/walkthrough/run/{step_id}  → re-run one step live (the "Reload" button)
  GET  /api/v1/walkthrough/stream         → SSE progress for the running step

The live run subprocesses scripts/walkthrough_run.py — the SAME code the build runs.
Recorded stdout/figures live under backend/app/walkthrough/recorded/ and are served
statically at /api/v1/walkthrough/assets/… (mounted in main.py).
"""
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter()

SCRIPTS_DIR  = Path(os.getenv("SCRIPTS_DIR", "/app/scripts"))
DATA_DIR     = Path(os.getenv("DATA_DIR", "/app/data"))
RECORDED_DIR = Path(__file__).resolve().parent.parent / "walkthrough" / "recorded"
RECORDED_DIR.mkdir(parents=True, exist_ok=True)

RUNNER = SCRIPTS_DIR / "walkthrough_run.py"

# ── Step registry ─────────────────────────────────────────────────────────────
# kind: "light" runs in seconds; "heavy" loads/trains and is confirm-gated in the UI.

STEPS: dict[str, dict] = {
    "business_scenario": {
        "phase": "business", "title": "Szenario & Einsparpotenzial", "kind": "light",
        "figures": [],
        "eli5": "Reine Annahmen-Rechnung: Flottengröße × Tagesverbrauch × Preisvorteil → € pro Jahr.",
        "code": '''# Szenario-Konstanten (eine Quelle der Wahrheit)
N_TRUCKS         = 25
LITERS_PER_TRUCK = 150          # max 500 km/Tag × 30 L/100 km
LITERS_FLEET_DAY = N_TRUCKS * LITERS_PER_TRUCK   # 3.750 L
WORK_DAYS        = 250

for ct in (1, 2, 5):            # Preisvorteil in ct/L
    per_day  = ct/100 * LITERS_FLEET_DAY
    per_year = per_day * WORK_DAYS
    print(f"{ct} ct/L → {per_day:.2f} €/Tag ≈ {per_year:,.0f} €/Jahr")''',
    },
    "geo_station_select": {
        "phase": "data", "title": "Stationsauswahl (Haversine + Sektor)", "kind": "heavy",
        "figures": [],
        "eli5": "Großkreis-Distanz statt Luftlinie, dann je Himmelsrichtung die Station mit den meisten Preisdaten.",
        "code": '''from scripts import geo_utils
geo = pd.read_parquet("stations_geo.parquet")   # ~15.400 Tankstellen

# Großkreis-Distanz + Kompasswinkel von Aalen zu jeder Station
geo["dist_km"] = [geo_utils.haversine(*AALEN, la, lo) for la, lo in coords]
geo["bearing"] = [geo_utils.bearing (*AALEN, la, lo) for la, lo in coords]
geo["sector"]  = geo["bearing"].apply(geo_utils.assign_sector)   # N/NE/E/SW/NW

ring = geo[(geo.dist_km >= 80) & (geo.dist_km <= 120)]           # 80–120 km Ring
# je Sektor die Station mit den meisten Preis-Ereignissen wählen''',
    },
    "eda_summary": {
        "phase": "data", "title": "EDA-Summary & Befunde", "kind": "light",
        "figures": ["eda_correlation.png", "eda_intraday.png"],
        "eli5": "Aus den Parquets Zensus/Histogramm/Qualität rechnen und die zwei Schlüssel-Befunde plotten.",
        "code": '''from build_eda_summary import build_summary
summary = build_summary()         # liest Parquets (kein 87-GB-Scan)
json.dump(summary, open("eda_summary.json", "w"))

# Befund 1 — alle Stationen hochkorreliert (r > 0,95)
corr = df[price_cols].corr()
plt.imshow(corr, cmap="YlOrRd", vmin=0.9, vmax=1.0)

# Befund 2 — Intraday-Muster (morgens teuer, nachts günstig)
by_hour = df[price_cols].mean(axis=1).groupby(idx.hour).mean()
plt.plot(by_hour.index, by_hour.values)''',
    },
    "region_history": {
        "phase": "data", "title": "Regionale Preis-Historie (alle Jahre)", "kind": "heavy",
        "figures": [],
        "eli5": "Aggregiert alle Stationen je PLZ-2-Region (ein Tag/Woche, 2014→heute) — speist die animierte Alle-Stationen-Karte.",
        "code": '''from scripts.build_region_history import build

# Alle Stationen → ~95 PLZ-2-Regionen, ein Tag pro ISO-Woche (≈625 Frames),
# Ø-Preis je Region für Diesel/E5/E10. Liest nur ~1 Datei/Woche → schnell & klein.
build(every=7)
# → data/processed/region_history.parquet  (+ region_meta.parquet)
#   Die Karte animiert diese Regionen über alle Jahre.''',
    },
    "feature_pipeline": {
        "phase": "prep", "title": "Feature-Pipeline & Split", "kind": "heavy",
        "figures": [],
        "eli5": "Loader baut 101 Features → 360 Ziele, splittet zeitlich und fittet den Scaler nur auf Train.",
        "code": '''from scripts.data_transform_spedition import SpeditionDataLoader

loader = SpeditionDataLoader(train_end="2021-12-31 23:00",
                             val_end="2023-12-31 23:00",
                             forecast_horizon=72, fuel_type="diesel")
X, y = loader.load()                       # X: 101 Features, y: 360 Ziele
X_tr, X_va, X_te, y_tr, y_va, y_te = loader.train_val_test_split(X, y)

# StandardScaler NUR auf Train fitten → kein Datenleck
scaler_X = StandardScaler().fit(X_tr)
scaler_y = StandardScaler().fit(y_tr)''',
    },
    "baseline": {
        "phase": "modeling", "title": "Baseline (DummyRegressor)", "kind": "light",
        "figures": [],
        "eli5": "Der DummyRegressor rät immer den Mittelwert — die Latte, die das MLP überspringen muss.",
        "code": '''from sklearn.dummy import DummyRegressor

dummy = DummyRegressor(strategy="mean").fit(X_train_s, y_train_s)
y_pred = scaler_y.inverse_transform(dummy.predict(X_test_s))
mae = mean_absolute_error(y_test.values, y_pred)
print(f"Baseline MAE: {mae:.3f} €/L")        # ~0,454 — zu schlagen''',
    },
    "train_mlp": {
        "phase": "modeling", "title": "MLP (32,) trainieren + Cross-Validation", "kind": "heavy",
        "figures": ["cv_folds.png"],
        "eli5": "5-Fold TimeSeriesSplit zur Absicherung, dann das finale (32,)-Netz auf allen Trainingsdaten.",
        "code": '''from sklearn.model_selection import TimeSeriesSplit
from scripts import model_utils

# 5-Fold Cross-Validation (zeitlich, kein Zufall) — Stabilitätsnachweis
for tr, va in TimeSeriesSplit(n_splits=5).split(X_train_s):
    m = model_utils.build_mlp(hidden_layer_sizes=(32,))
    m.fit(X_train_s[tr], y_train_s[tr])
    ...

# finales Modell + speichern (Modell, Scaler, Spalten) als joblib
model = model_utils.train_mlp(X_train_s, y_train_s, hidden_layer_sizes=(32,))
joblib.dump({"model": model, "scaler_X": scaler_X, "scaler_y": scaler_y,
             "feature_columns": list(X.columns),
             "target_columns": list(y.columns)}, "spedition_mlp.joblib")''',
    },
    "arch_compare": {
        "phase": "modeling", "title": "Architektur-Vergleich (7 Netze × 2)", "kind": "light",
        "figures": ["arch_std.png", "arch_patient.png"],
        "eli5": "Sieben Netzgrößen, zweimal verglichen — (32,) gewinnt; tiefere Netze overfitten.",
        "code": '''archs = [(32,), (128,), (64,), (16,), (64,128), (128,256), (64,128,256)]

# zwei Experimente: geduldige vs. Standard-Trainingsparameter
for params in [dict(n_iter_no_change=100, tol=1e-5, max_iter=2000),
               dict(n_iter_no_change=50,  max_iter=1000)]:
    df = model_utils.run_architecture_comparison(
        archs, X_train_s, y_train_s, X_val_s, y_val.values, scaler_y, **params)
    df.sort_values("val_mae").plot.bar(x="architecture", y="val_mae")''',
    },
    "evaluate": {
        "phase": "evaluation", "title": "Testergebnisse & Fehler je Horizont", "kind": "light",
        "figures": ["mae_rmse_horizon.png"],
        "eli5": "Gespeichertes Modell laden, auf dem Testjahr 2024+ bewerten, Fehler je Horizont plotten.",
        "code": '''art = joblib.load("spedition_mlp.joblib")        # Modell laden
y_pred = art["scaler_y"].inverse_transform(art["model"].predict(X_test_s))

mae  = mean_absolute_error(y_test.values, y_pred)
rmse = np.sqrt(mean_squared_error(y_test.values, y_pred))
r2   = r2_score(y_test.values, y_pred)
skill = (1 - mae/0.454) * 100
print(f"MAE={mae:.3f}  RMSE={rmse:.3f}  R²={r2:.3f}  Skill={skill:.1f}%")

# Fehler je Forecast-Horizont (1…72 h)
cube_t, cube_p = reshape(y_true), reshape(y_pred)   # (T, 72, 5)''',
    },
    "pick_accuracy": {
        "phase": "evaluation", "title": "Pick Accuracy & Spearman", "kind": "light",
        "figures": ["pick_accuracy_horizon.png", "actual_vs_pred_14d.png"],
        "eli5": "Wie oft trifft das Modell die wirklich günstigste Station? Und stimmt die Reihenfolge?",
        "code": '''# je Horizont: ist die vorhergesagte günstigste Station die echte?
for h in range(72):
    true_min = cube_t[:, h, :].argmin(axis=1)
    pred_min = cube_p[:, h, :].argmin(axis=1)
    acc[h]   = (true_min == pred_min).mean()          # ~0,46 gesamt
    rho[h]   = spearmanr(cube_t[:, h], cube_p[:, h])   # Rang-Korrelation

print(f"Pick Accuracy: {np.mean(acc)*100:.1f}%  (Zufall 20%)")''',
    },
    "dispatch": {
        "phase": "deployment", "title": "Dispatch-Empfehlung & Persistenz", "kind": "light",
        "figures": [],
        "eli5": "Aus der aktuellen Lage die günstigste Station je Horizont ranken — fertig für die Disposition.",
        "code": '''from scripts.model_utils import recommend_cheapest_station

rec = recommend_cheapest_station(model, scaler_X, scaler_y,
        X_test, target_columns, horizon_h=8, tank_liter=150)

print("Empfehlung:", rec["recommendation"], "→", rec["expected_price"])
for route, price in rec["ranking"]:
    print(f"  {route}: {price:.3f} €/L")
# Spread günstigste↔teuerste × 150 L = € je Tankfüllung''',
    },
    "b29_contrast": {
        "phase": "reflexion", "title": "Verworfener B29-Ansatz (4 Cluster)", "kind": "light",
        "figures": [],
        "eli5": "Der ursprüngliche Cluster-Ansatz — und warum er verworfen wurde.",
        "code": '''B29_CLUSTERS = {                       # bis zu 80 Stationen je Region gemittelt
    "Aalen":            [73430, 73431, ...],
    "Schwäbisch Gmünd": [73525, 73526, ...],
    "Schorndorf":       [73614, 73655, ...],
    "Stuttgart":        [70173, 70174, ...],   # 36 PLZ-Gebiete
}
# Problem 1: kein Mehrwert ggü. Echtzeit-Apps (Nowcasting genügt)
# Problem 2: Cluster-Mittelung glättet → künstlich leichte Vorhersage
# → Pivot auf 5 konkrete Einzelstationen''',
    },
    "b29_train": {
        "phase": "reflexion", "title": "B29-Modell trainieren (b29_mlp.joblib)", "kind": "heavy",
        "figures": [],
        "eli5": "Erzeugt das verworfene B29-Cluster-Modell. Ohne dieses joblib nutzt das Backend einen Persistence-Fallback.",
        "code": '''from scripts.data_transform import B29DataLoader
from scripts import model_utils

# 4 Cluster aus dem b29_hourly-Cache → 80 Features → 288 Ausgaben
loader = B29DataLoader(forecast_horizon=72, fuel_type="diesel")
X, y = loader.load()
X_tr, X_va, X_te, y_tr, y_va, y_te = loader.train_val_test_split(X, y)

model = model_utils.train_mlp(X_train_s, y_train_s, hidden_layer_sizes=(32,))
joblib.dump({"model": model, "scaler_X": scaler_X, "scaler_y": scaler_y,
             "feature_columns": list(X.columns),
             "target_columns": list(y.columns)}, "b29_mlp.joblib")
# → Karte/Reflexion nutzen jetzt echte B29-Vorhersagen statt Persistence.''',
    },
}

PHASE_ORDER: dict[str, list[str]] = {
    "business":   ["business_scenario"],
    "data":       ["geo_station_select", "eda_summary", "region_history"],
    "prep":       ["feature_pipeline"],
    "modeling":   ["baseline", "train_mlp", "arch_compare"],
    "evaluation": ["evaluate", "pick_accuracy"],
    "deployment": ["dispatch"],
    "reflexion":  ["b29_contrast", "b29_train"],
}


def _recorded_stdout(step_id: str) -> str:
    p = RECORDED_DIR / f"{step_id}.out.txt"
    return p.read_text(encoding="utf-8") if p.exists() else ""


def _step_payload(step_id: str) -> dict:
    s = STEPS[step_id]
    figs = [f"/api/v1/walkthrough-assets/{name}" for name in s["figures"]
            if (RECORDED_DIR / name).exists()]
    return {
        "step_id": step_id,
        "title":   s["title"],
        "kind":    s["kind"],
        "eli5":    s["eli5"],
        "code":    s["code"],
        "recorded_stdout": _recorded_stdout(step_id),
        "figures": figs,
    }


# ── live-run state (self-contained SSE, mirrors setup.py) ─────────────────────

_state: dict = {"running": None, "messages": [], "done": False}


def _push(msg: dict) -> None:
    _state["messages"].append(msg)
    if len(_state["messages"]) > 500:
        _state["messages"].pop(0)


@router.get("/{phase}")
async def get_phase(phase: str):
    if phase not in PHASE_ORDER:
        raise HTTPException(404, f"Unknown phase '{phase}'")
    return {"phase": phase, "steps": [_step_payload(s) for s in PHASE_ORDER[phase]]}


async def _run_step(step_id: str):
    _state["running"] = step_id
    _state["done"] = False
    _push({"step_id": step_id, "status": "running", "message": f"Starte {step_id} …"})
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(RUNNER), step_id, "--record",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, "DATA_DIR": str(DATA_DIR), "PYTHONUNBUFFERED": "1",
                 "WALKTHROUGH_RECORDED_DIR": str(RECORDED_DIR)},
        )
        async for line_bytes in proc.stdout:
            line = line_bytes.decode("utf-8", errors="replace").rstrip()
            if line and "PerformanceWarning" not in line and "df[tc]" not in line:
                _push({"step_id": step_id, "status": "running", "message": line[:300]})
        await proc.wait()
        ok = proc.returncode == 0
        _push({"step_id": step_id, "status": "done" if ok else "error",
               "message": "Fertig!" if ok else f"Fehler (exit {proc.returncode})"})
    except Exception as exc:
        _push({"step_id": step_id, "status": "error", "message": str(exc)})
    finally:
        _state["running"] = None
        _state["done"] = True


@router.post("/run/{step_id}")
async def run_step(step_id: str):
    if step_id not in STEPS:
        raise HTTPException(404, f"Unknown step '{step_id}'")
    if _state["running"]:
        return {"ok": False, "error": f"Läuft bereits: {_state['running']}"}
    # Reset synchronously so a freshly-connecting EventSource doesn't see a stale "done".
    _state["messages"].clear()
    _state["done"] = False
    _state["running"] = step_id
    asyncio.create_task(_run_step(step_id))
    return {"ok": True, "started": step_id, "kind": STEPS[step_id]["kind"]}


@router.get("/run-state/stream")
async def stream():
    last = [0]

    async def gen() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'status': 'connected'})}\n\n"
        while True:
            msgs = _state["messages"]
            for m in msgs[last[0]:]:
                yield f"data: {json.dumps(m)}\n\n"
            last[0] = len(msgs)
            if _state["done"] and last[0] == len(_state["messages"]) and not _state["running"]:
                break
            await asyncio.sleep(0.3)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
