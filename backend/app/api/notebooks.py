"""
Notebooks API — list and render Jupyter notebooks as HTML.

Notebooks are mounted read-only at /app/notebooks via docker-compose.yml.
nbconvert is available as a transitive dependency of jupyter==1.0.0.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

NOTEBOOKS_DIR = Path("/app/notebooks")

# Scratch/work-in-progress notebooks excluded from the public list
_EXCLUDED = {"Scribble.ipynb"}

# Human-readable display names
_DISPLAY_NAMES = {
    "spedition_mlp.ipynb":               "Spedition MLP (5 Stationen)",
    "b29_fleet_mlp.ipynb":               "B29 Flotten-MLP",
    "spritpreis_mlp.ipynb":              "Nationales MLP (Baseline)",
    "spritpreis_b29_mlp_bereinigt.ipynb": "B29 MLP (bereinigt)",
    "all_stations_geo_mlp.ipynb":        "Geo-MLP (alle BW-Stationen)",
    "data-exploration.ipynb":            "Datenexploration",
}


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

    notebooks = []
    for path in sorted(NOTEBOOKS_DIR.glob("*.ipynb")):
        if path.name in _EXCLUDED:
            continue
        notebooks.append(_notebook_meta(path))

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
