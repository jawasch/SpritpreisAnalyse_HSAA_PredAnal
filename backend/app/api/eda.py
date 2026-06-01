"""
EDA API — serves pre-computed exploratory data analysis summary.
Run scripts/build_eda_summary.py once to generate data/processed/eda_summary.json.
"""
import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
EDA_FILE = DATA_DIR / "processed" / "eda_summary.json"


@router.get("/summary")
async def get_eda_summary():
    """Return pre-computed EDA summary (census, outliers, coverage, distributions)."""
    if not EDA_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "EDA summary not found. "
                "Run `python scripts/build_eda_summary.py` from the project root "
                "to generate data/processed/eda_summary.json."
            ),
        )
    with EDA_FILE.open(encoding="utf-8") as f:
        return json.load(f)
