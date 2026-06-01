"""
Notebooks API — list and render Jupyter notebooks as HTML.

Notebooks are mounted read-only at /app/notebooks via docker-compose.yml.
nbconvert is available as a transitive dependency of jupyter==1.0.0.
"""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

NOTEBOOKS_DIR = Path(os.getenv("NOTEBOOKS_DIR", "/app/notebooks"))

# Scratch / superseded notebooks excluded from the public list.
# Kept robust in case the files still linger on disk.
_EXCLUDED = {
    "Scribble.ipynb",
    "all_stations_geo_mlp.ipynb",
    "spritpreis_mlp.ipynb",
    "spritpreis_b29_mlp_bereinigt.ipynb",
    "FIN_all_germany_web_mlp.ipynb",
}

# Human-readable display names — only the four curated project notebooks
_DISPLAY_NAMES = {
    "data-exploration.ipynb":    "01 · Datenexploration",
    "spedition_mlp.ipynb":       "02 · Spedition MLP (5 Stationen) ★",
    "b29_fleet_mlp.ipynb":       "03 · B29 Fleet MLP (verworfener Ansatz)",
    "all_germany_web_mlp.ipynb": "04 · All-Germany MLP (Ausblick)",
}

# Desired sort order for curated notebooks
_SORT_ORDER = [
    "data-exploration.ipynb",
    "spedition_mlp.ipynb",
    "b29_fleet_mlp.ipynb",
    "all_germany_web_mlp.ipynb",
]


def _notebook_meta(path: Path) -> dict:
    """Return lightweight metadata for a notebook without parsing cell content."""
    try:
        import nbformat
        with path.open(encoding="utf-8") as f:
            nb = nbformat.read(f, as_version=4)
        has_outputs = any(
            bool(cell.get("outputs"))
            for cell in nb.cells
            if cell.cell_type == "code"
        )
    except Exception:
        has_outputs = False

    return {
        "name": path.name,
        "display_name": _DISPLAY_NAMES.get(path.name, path.stem.replace("_", " ").title()),
        "size_kb": round(path.stat().st_size / 1024, 1),
        "has_outputs": has_outputs,
    }


@router.get("")
async def list_notebooks():
    """List all available notebooks with metadata."""
    if not NOTEBOOKS_DIR.exists():
        return {"notebooks": []}

    all_paths = {p.name: p for p in NOTEBOOKS_DIR.glob("*.ipynb") if p.name not in _EXCLUDED}

    # Sort by curated order, then alphabetically for the rest
    ordered_names = [n for n in _SORT_ORDER if n in all_paths]
    remaining     = sorted(n for n in all_paths if n not in _SORT_ORDER)

    notebooks = [_notebook_meta(all_paths[n]) for n in ordered_names + remaining]
    return {"notebooks": notebooks}


@router.get("/{name}/html")
async def get_notebook_html(name: str):
    """
    Convert a notebook to HTML and return the rendered body.

    Uses nbconvert's 'basic' template which omits the full page chrome
    (no Jupyter navbar), returning just the cell content suitable for
    embedding in an iframe via srcDoc.
    """
    # Sanitise: only .ipynb files, no path traversal
    if not name.endswith(".ipynb") or "/" in name or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid notebook name")

    if name in _EXCLUDED:
        raise HTTPException(status_code=404, detail="Notebook not available")

    path = NOTEBOOKS_DIR / name
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Notebook '{name}' not found")

    try:
        import nbformat
        from nbconvert import HTMLExporter

        with path.open(encoding="utf-8") as f:
            nb = nbformat.read(f, as_version=4)

        exporter = HTMLExporter(template_name="lab")
        html_body, _ = exporter.from_notebook_node(nb)

        return {"name": name, "html": html_body}

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to convert notebook: {exc}",
        )
