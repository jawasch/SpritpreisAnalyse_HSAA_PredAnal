"""
Models API — serves model cards (architecture, metrics, description) for all trained models.
Reads joblib metadata where available; falls back to curated data/processed/model_cards.json.
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
MODEL_CARDS_FILE = DATA_DIR / "processed" / "model_cards.json"

# Curated fallback model cards (notebook test-set results)
_DEFAULT_CARDS = [
    {
        "id":           "b29",
        "name":         "B29 Fleet MLP",
        "subtitle":     "4 Cluster · B29-Korridor Aalen → Stuttgart",
        "architecture": "80 → [256, 128] → 288",
        "fuel_types":   ["diesel"],
        "n_inputs":     80,
        "n_outputs":    288,
        "n_locations":  4,
        "horizon_h":    72,
        "mae":          0.031,
        "rmse":         0.042,
        "r2":           0.93,
        "baseline_mae": 0.040,
        "skill_pct":    22.5,
        "train_period": "2014–2021",
        "val_period":   "2022–2023",
        "test_period":  "2024–heute",
        "description":  (
            "Erstes Modell im Projekt: 25 LKWs auf der B29, "
            "4 geografische Cluster (Aalen, Schwäbisch Gmünd, Schorndorf, Stuttgart). "
            "Multi-Output MLP mit 80 Eingangsfeatures (Lags, Rolling, sin/cos-Zeit) "
            "und 288 Ausgaben (4 Cluster × 72 Stunden)."
        ),
        "eli5": (
            "Stell dir 4 ‚Preiszentren' entlang der B29 vor. "
            "Das Modell schaut, wie die Preise in den letzten 7 Tagen verliefen "
            "und lernt daraus, wie sie sich in den nächsten 72 Stunden entwickeln."
        ),
    },
    {
        "id":                   "spedition",
        "name":                 "Spedition MLP",
        "subtitle":             "5 Stationen · 5 feste Routen ab Aalen",
        "architecture":         "101 → [256, 128] → 360",
        "fuel_types":           ["diesel"],
        "n_inputs":             101,
        "n_outputs":            360,
        "n_locations":          5,
        "horizon_h":            72,
        "mae":                  0.0377,
        "rmse":                 0.0490,
        "r2":                   0.9278,
        "baseline_mae":         0.049,
        "skill_pct":            23.1,
        "pick_accuracy_t1":     0.61,
        "baseline_pick_acc":    0.20,
        "spearman_avg":         0.75,
        "savings_per_day_eur":  17.0,
        "train_period":         "2014–2021",
        "val_period":           "2022–2023",
        "test_period":          "2024–heute",
        "description":          (
            "Template-Modell des Projekts: 5 konkrete Tankstellen auf 5 Himmelsrichtungs-Routen "
            "(80–120 km von Aalen). Station-Discovery via Haversine + Sektoren. "
            "Pick-Accuracy: in 61 % der Stunden wird die richtige (günstigste) Station "
            "vorhergesagt — 3× besser als Zufall (20 %)."
        ),
        "eli5": (
            "Das Modell nimmt die letzten Preise von 5 Tankstellen und fragt: "
            "‚Welche wird in 8 Stunden am günstigsten sein?' "
            "Wie ein erfahrener Disponent, der aus dem Preisrhythmus der Woche lernt."
        ),
    },
    {
        "id":           "all_germany_diesel",
        "name":         "All-Germany MLP (Diesel)",
        "subtitle":     "9 Orte · Deutschland-weites Modell",
        "architecture": "519 → [128, 64] → ...",
        "fuel_types":   ["diesel"],
        "n_inputs":     519,
        "n_outputs":    None,
        "n_locations":  9,
        "horizon_h":    72,
        "mae":          None,
        "r2":           None,
        "description":  (
            "Breiter Ansatz: B29-Cluster + Spedition-Stationen kombiniert, "
            "dazu alle drei Kraftstofftypen (Diesel, E5, E10) als Features. "
            "519 Eingangsfeatures ermöglichen es, Preiswechselwirkungen zwischen "
            "Regionen und Kraftstoffarten zu lernen."
        ),
        "eli5": (
            "Mehr Daten, mehr Wissen: Statt 5 Stationen sieht das Modell 9 Orte "
            "und alle 3 Kraftstofftypen gleichzeitig. "
            "So lernt es z. B., dass ein Dieselpreisanstieg in Stuttgart "
            "oft dem E5-Anstieg in Aalen um einige Stunden vorausgeht."
        ),
    },
    {
        "id":           "all_germany_e5",
        "name":         "All-Germany MLP (E5)",
        "subtitle":     "9 Orte · Deutschland-weites Modell",
        "architecture": "519 → [128, 64] → ...",
        "fuel_types":   ["e5"],
        "n_inputs":     519,
        "n_outputs":    None,
        "n_locations":  9,
        "horizon_h":    72,
        "mae":          None,
        "r2":           None,
        "description":  "Identische Architektur wie Diesel-Modell, trainiert auf E5-Preisen.",
        "eli5": "Gleiche Logik, anderer Kraftstoff — E5-Preise folgen anderen Mustern als Diesel.",
    },
    {
        "id":           "all_germany_e10",
        "name":         "All-Germany MLP (E10)",
        "subtitle":     "9 Orte · Deutschland-weites Modell",
        "architecture": "519 → [128, 64] → ...",
        "fuel_types":   ["e10"],
        "n_inputs":     519,
        "n_outputs":    None,
        "n_locations":  9,
        "horizon_h":    72,
        "mae":          None,
        "r2":           None,
        "description":  "Identische Architektur wie Diesel-Modell, trainiert auf E10-Preisen.",
        "eli5": "E10 ist oft günstiger als E5 — das Modell lernt diesen systematischen Abstand.",
    },
]


def _enrich_from_joblib(cards: list[dict]) -> list[dict]:
    """Try to read val_mae / architecture from saved joblib artifacts."""
    try:
        import joblib
        from ..services.ml_service import ALL_GERMANY_MODELS, SPEDITION_MODEL

        enriched = []
        for card in cards:
            c = dict(card)
            if card["id"] == "spedition" and SPEDITION_MODEL.exists():
                try:
                    art = joblib.load(SPEDITION_MODEL)
                    c["n_inputs"]  = len(art.get("feature_columns", []))
                    c["n_outputs"] = len(art.get("target_columns", []))
                except Exception:
                    pass
            for ft in ("diesel", "e5", "e10"):
                if card["id"] == f"all_germany_{ft}":
                    path = ALL_GERMANY_MODELS.get(ft)
                    if path and path.exists():
                        try:
                            art = joblib.load(path)
                            c["available"]    = True
                            c["n_inputs"]     = len(art.get("feature_columns", []))
                            c["n_outputs"]    = len(art.get("target_columns", []))
                            c["mae"]          = art.get("val_mae")
                            c["architecture"] = art.get("architecture", c["architecture"])
                        except Exception:
                            pass
                    else:
                        c["available"] = False
            enriched.append(c)
        return enriched
    except Exception:
        return cards


@router.get("")
async def list_models():
    """Return all model cards with architecture, metrics, and ELI5 descriptions."""
    cards = _enrich_from_joblib(_DEFAULT_CARDS)
    return {"ok": True, "models": cards}


@router.get("/{model_id}")
async def get_model(model_id: str):
    """Return a single model card by ID."""
    cards = _enrich_from_joblib(_DEFAULT_CARDS)
    match = next((c for c in cards if c["id"] == model_id), None)
    if not match:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return match
