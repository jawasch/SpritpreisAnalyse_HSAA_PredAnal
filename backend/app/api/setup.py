"""
Setup API — checks availability of data components and runs build scripts.

GET  /api/v1/setup/status      → component status list
POST /api/v1/setup/run-all     → build all missing scriptable components
POST /api/v1/setup/run/{id}    → build one specific component
GET  /api/v1/setup/stream      → SSE stream of progress updates
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

DATA_DIR      = Path(os.getenv("DATA_DIR", "/app/data"))
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR    = DATA_DIR / "models"
SCRIPTS_DIR   = Path(os.getenv("SCRIPTS_DIR", "/app/scripts"))

# ── Component registry ────────────────────────────────────────────────────────

def _exists(rel: str) -> bool:
    return (DATA_DIR / rel).exists()


def _component_status(comp: dict) -> str:
    if comp.get("notebook_required"):
        return "notebook_required" if not (DATA_DIR / comp["path"]).exists() else "ok"
    return "ok" if (DATA_DIR / comp["path"]).exists() else "missing"


TANKERKOENIG_ROOT = Path(os.getenv("TANKERKOENIG_DATA_PATH", str(DATA_DIR / "tankerkoenig-data")))


def _check_tankerkoenig() -> tuple[bool, str]:
    """Return (ok, error_message) — validates the raw-data mount before scripts run."""
    if not TANKERKOENIG_ROOT.exists():
        return False, (
            f"Rohdaten-Verzeichnis nicht gefunden: {TANKERKOENIG_ROOT}\n"
            "Prüfe docker-compose.yml Volume-Mount "
            "(../tankerkoenig-data:/app/data/tankerkoenig-data:ro) "
            "und führe 'git pull' im tankerkoenig-data Repository aus."
        )
    prices_dir = TANKERKOENIG_ROOT / "prices"
    if not prices_dir.exists():
        return False, (
            f"Kein 'prices/'-Unterverzeichnis in {TANKERKOENIG_ROOT}. "
            "Prüfe ob das Repository vollständig ausgecheckt ist."
        )
    # Check that at least one CSV exists
    found = next(prices_dir.rglob("*.csv"), None)
    if found is None:
        return False, (
            f"Keine CSV-Dateien in {prices_dir}. "
            "Führe 'git pull' im tankerkoenig-data Repository aus."
        )
    return True, ""


COMPONENTS = [
    {
        "id":     "b29_parquet",
        "label":  "B29 Parquet (4 Cluster, 2014–heute)",
        "path":   "processed/b29_hourly_diesel_all_all.parquet",
        "script": None,   # produced by b29_fleet_mlp.ipynb, not a standalone script
        "notebook_required": True,
        "notebook": "b29_fleet_mlp.ipynb",
        "description": "Stündliche Dieselpreise für 4 B29-Cluster (Aalen→Stuttgart).",
    },
    {
        "id":     "spedition_parquet",
        "label":  "Speditions-Parquet (5 Stationen)",
        "path":   "processed/spedition_5stations_diesel_all_all.parquet",
        "script": None,
        "notebook_required": True,
        "notebook": "spedition_mlp.ipynb",
        "description": "Stündliche Dieselpreise für 5 feste Speditions-Stationen.",
    },
    {
        "id":     "eda_summary",
        "label":  "EDA Summary (Datenexploration)",
        "path":   "processed/eda_summary.json",
        "script": "build_eda_summary.py",
        "description": "Zensus, Histogramme, Qualitäts-Metriken aus Parquet-Daten.",
    },
    {
        "id":     "oil_prices",
        "label":  "Ölpreise Brent (EIA API)",
        "path":   "processed/oil_brent.parquet",
        "script": "fetch_oil_prices.py",
        "description": "Tägliche Brent-Rohölpreise (USD/bbl) für Analyse-Kontext.",
    },
    {
        "id":     "recent_prices",
        "label":  "Aktuelle Stationspreise (letzte 7 Tage, alle 15k)",
        "path":   "processed/recent_prices_diesel_7d.parquet",
        "script": "build_recent_prices.py",
        "needs_tankerkoenig": True,
        "description": "Echte Stundenpreise aller Tankstellen aus Rohdaten — für 3D-Karte.",
    },
    {
        "id":     "spedition_model",
        "label":  "Speditions-MLP (joblib)",
        "path":   "models/spedition_mlp.joblib",
        "script": None,
        "notebook_required": True,
        "notebook": "spedition_mlp.ipynb",
        "description": "Trainiertes MLP: 101 Features → 72h Dieselpreis-Prognose.",
    },
    {
        "id":     "b29_model",
        "label":  "B29 Fleet MLP (joblib)",
        "path":   "models/b29_mlp.joblib",
        "script": None,
        "notebook_required": True,
        "notebook": "b29_fleet_mlp.ipynb",
        "description": "B29-Cluster-MLP. Fehlt: Persistence-Fallback aktiv.",
    },
    {
        "id":     "all_germany_diesel",
        "label":  "All-Germany MLP Diesel (joblib)",
        "path":   "models/all_germany_diesel_mlp.joblib",
        "script": None,
        "notebook_required": True,
        "notebook": "all_germany_web_mlp.ipynb",
        "description": "Nationales Diesel-MLP (519 Features).",
    },
    {
        "id":     "all_germany_e5",
        "label":  "All-Germany MLP E5 (joblib)",
        "path":   "models/all_germany_e5_mlp.joblib",
        "script": None,
        "notebook_required": True,
        "notebook": "all_germany_web_mlp.ipynb",
        "description": "Nationales E5-MLP.",
    },
    {
        "id":     "all_germany_e10",
        "label":  "All-Germany MLP E10 (joblib)",
        "path":   "models/all_germany_e10_mlp.joblib",
        "script": None,
        "notebook_required": True,
        "notebook": "all_germany_web_mlp.ipynb",
        "description": "Nationales E10-MLP.",
    },
]

# ── In-memory run state ───────────────────────────────────────────────────────

_state: dict = {
    "running":  None,       # component id currently being built
    "messages": [],         # list of SSE message dicts (rolling buffer)
    "done":     False,
}


def _push(msg: dict):
    _state["messages"].append(msg)
    if len(_state["messages"]) > 500:
        _state["messages"].pop(0)


def _get_components() -> list[dict]:
    tk_ok, tk_err = _check_tankerkoenig()
    result = []
    for c in COMPONENTS:
        path = DATA_DIR / c["path"]
        if c.get("notebook_required") and not path.exists():
            status = "notebook_required"
            hint = None
        elif path.exists():
            status = "ok"
            hint = None
        elif c.get("needs_tankerkoenig") and not tk_ok:
            status = "data_missing"
            hint = tk_err
        else:
            status = "missing"
            hint = None

        entry = {
            "id":                c["id"],
            "label":             c["label"],
            "description":       c.get("description", ""),
            "path":              c["path"],
            "status":            status,
            "script":            c.get("script"),
            "notebook":          c.get("notebook"),
            "notebook_required": c.get("notebook_required", False),
            "needs_tankerkoenig": c.get("needs_tankerkoenig", False),
        }
        if hint:
            entry["hint"] = hint
        if status == "ok":
            entry["size_kb"] = round(path.stat().st_size / 1024, 1)
            entry["mtime"] = datetime.fromtimestamp(
                path.stat().st_mtime
            ).strftime("%Y-%m-%d %H:%M")
        result.append(entry)
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    components = _get_components()
    scriptable_missing = [
        c for c in components if c["status"] == "missing" and c["script"]
    ]
    return {
        "ok":        True,
        "components": components,
        "all_ready": all(c["status"] in ("ok", "notebook_required") for c in components),
        "running":   _state["running"],
        "scriptable_missing_count": len(scriptable_missing),
    }


async def _run_script(component_id: str, script_name: str):
    # Pre-check: does this component need the tankerkönig raw data?
    comp = next((c for c in COMPONENTS if c["id"] == component_id), {})
    if comp.get("needs_tankerkoenig"):
        ok, err = _check_tankerkoenig()
        if not ok:
            _push({"component": component_id, "status": "error",
                   "progress": 100, "message": err})
            _state["running"] = None
            return False

    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        msg = f"Skript nicht gefunden: {script_path}"
        _push({"component": component_id, "status": "error",
               "progress": 100, "message": msg})
        _state["running"] = None
        return False

    _state["running"] = component_id
    _push({"component": component_id, "status": "running",
           "progress": 0, "message": f"Starte {script_name} …"})
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(script_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, "DATA_DIR": str(DATA_DIR),
                 "PYTHONUNBUFFERED": "1"},
        )
        line_count = 0
        last_lines: list[str] = []   # rolling buffer for error context
        async for line_bytes in proc.stdout:
            line = line_bytes.decode("utf-8", errors="replace").rstrip()
            if line:
                line_count += 1
                last_lines.append(line)
                if len(last_lines) > 10:
                    last_lines.pop(0)
                _push({"component": component_id, "status": "running",
                       "progress": min(90, line_count * 5),
                       "message": line[:200]})
        await proc.wait()
        success = proc.returncode == 0
        if success:
            _push({"component": component_id, "status": "done",
                   "progress": 100, "message": "Fertig!"})
        else:
            # Find the most informative error line (prefer Error/Exception lines)
            error_lines = [l for l in last_lines
                           if any(k in l for k in ("Error", "Exception", "error:", "Warning"))]
            error_msg = (error_lines[-1] if error_lines else (last_lines[-1] if last_lines else ""))
            error_msg = error_msg[:300] or f"Fehler (exit {proc.returncode})"
            _push({"component": component_id, "status": "error",
                   "progress": 100, "message": error_msg})
        return success
    except Exception as e:
        _push({"component": component_id, "status": "error",
               "progress": 100, "message": str(e)})
        return False
    finally:
        _state["running"] = None


@router.post("/run/{component_id}")
async def run_component(component_id: str):
    comp = next((c for c in COMPONENTS if c["id"] == component_id), None)
    if not comp:
        return {"ok": False, "error": "Unknown component"}
    if not comp.get("script"):
        return {"ok": False, "error": "This component requires a Notebook run, no script available."}
    if _state["running"]:
        return {"ok": False, "error": f"Already running: {_state['running']}"}
    asyncio.create_task(_run_script(component_id, comp["script"]))
    return {"ok": True, "started": component_id}


@router.post("/run-all")
async def run_all():
    if _state["running"]:
        return {"ok": False, "error": f"Already running: {_state['running']}"}

    async def _sequential():
        _state["done"] = False
        for comp in COMPONENTS:
            if not comp.get("script"):
                continue
            path = DATA_DIR / comp["path"]
            if path.exists():
                _push({"component": comp["id"], "status": "ok",
                       "progress": 100, "message": "Bereits vorhanden — übersprungen."})
                continue
            await _run_script(comp["id"], comp["script"])
        _state["done"] = True
        _push({"component": "__all__", "status": "done",
               "progress": 100, "message": "Alle Komponenten aufgebaut."})

    asyncio.create_task(_sequential())
    return {"ok": True, "message": "Setup gestartet — SSE-Stream verbinden für Fortschritt."}


@router.get("/stream")
async def stream_progress():
    """Server-Sent Events stream — push progress updates to the frontend."""
    last_idx = [0]

    async def generator() -> AsyncGenerator[str, None]:
        # Send initial status
        status_data = {
            "component": "__status__",
            "status": "connected",
            "progress": 0,
            "message": "Verbunden mit Setup-Stream.",
        }
        yield f"data: {json.dumps(status_data)}\n\n"

        while True:
            msgs = _state["messages"]
            new_msgs = msgs[last_idx[0]:]
            for msg in new_msgs:
                yield f"data: {json.dumps(msg)}\n\n"
            last_idx[0] = len(msgs)

            if _state["done"] and not new_msgs:
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
