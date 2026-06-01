"""
Geospatial utilities for station discovery in spedition_mlp.ipynb.

Covers great-circle distance, compass bearing, sector assignment,
and selecting the best-covered station per directional sector.
"""

from math import radians, sin, cos, sqrt, atan2, degrees

import numpy as np
import pandas as pd


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two (lat, lon) points."""
    R = 6_371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Initial compass bearing in degrees from point 1 to point 2.
    0° = North, 90° = East, 180° = South, 270° = West.
    """
    dlon = radians(lon2 - lon1)
    x = sin(dlon) * cos(radians(lat2))
    y = (
        cos(radians(lat1)) * sin(radians(lat2))
        - sin(radians(lat1)) * cos(radians(lat2)) * cos(dlon)
    )
    return (degrees(atan2(x, y)) + 360) % 360


def assign_sector(bearing_deg: float) -> str:
    """
    Map a compass bearing to one of five direction sectors.

    Boundaries (centred on each cardinal / intercardinal direction):
      N  : [337.5°, 360°) ∪ [0°, 22.5°)
      NE : [22.5°, 67.5°)
      E  : [67.5°, 157.5°)
      SW : [157.5°, 247.5°)
      NW : [247.5°, 337.5°)
    """
    if bearing_deg < 22.5 or bearing_deg >= 337.5:
        return "N"
    if bearing_deg < 67.5:
        return "NE"
    if bearing_deg < 157.5:
        return "E"
    if bearing_deg < 247.5:
        return "SW"
    return "NW"


def compute_competition_density(
    df_stations: pd.DataFrame,
    radius_km: float = 2.0,
    lat_col: str = "latitude",
    lon_col: str = "longitude",
) -> pd.DataFrame:
    """
    For each station compute the number of competitors within `radius_km` and
    the distance to the nearest competitor.

    Uses a fully vectorised pairwise Haversine matrix (O(N²) memory, fast for
    N ≤ ~5000). For N=2000 the distance matrix is ≈32 MB of float64.

    Parameters
    ----------
    df_stations : pd.DataFrame  — must contain columns: uuid, lat_col, lon_col
    radius_km   : float         — competition radius in km
    lat_col     : str           — column name for latitude
    lon_col     : str           — column name for longitude

    Returns
    -------
    pd.DataFrame with columns:
        uuid, competitor_count_{radius_km}km, nearest_competitor_km
    """
    lats = np.radians(df_stations[lat_col].values.astype(float))
    lons = np.radians(df_stations[lon_col].values.astype(float))

    R = 6_371.0
    dlat = lats[:, None] - lats[None, :]
    dlon = lons[:, None] - lons[None, :]
    a = (np.sin(dlat / 2) ** 2
         + np.cos(lats[:, None]) * np.cos(lats[None, :]) * np.sin(dlon / 2) ** 2)
    dist = R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    np.fill_diagonal(dist, np.inf)

    radius_col = f"competitor_count_{int(radius_km)}km"
    return pd.DataFrame({
        "uuid": df_stations["uuid"].values,
        radius_col: (dist <= radius_km).sum(axis=1).astype(int),
        "nearest_competitor_km": dist.min(axis=1),
    })


def select_best_station_per_sector(candidates: pd.DataFrame) -> pd.DataFrame:
    """
    Return one row per sector: the station with the most price events.

    Parameters
    ----------
    candidates : pd.DataFrame
        Must contain columns: sector, uuid, name, brand, city,
        dist_km, bearing, n_events.

    Returns
    -------
    pd.DataFrame
        One row per sector, sorted by sector label.
        Columns: [sector, uuid, name, brand, city, dist_km, bearing, n_events].
    """
    return (
        candidates
        .sort_values("n_events", ascending=False)
        .groupby("sector")
        .first()
        .reset_index()[["sector", "uuid", "name", "brand", "city", "dist_km", "bearing", "n_events"]]
    )
