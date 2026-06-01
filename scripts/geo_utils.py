"""
Geospatial utilities for station discovery in spedition_mlp.ipynb.

Covers great-circle distance, compass bearing, sector assignment,
and selecting the best-covered station per directional sector.
"""

from math import radians, sin, cos, sqrt, atan2, degrees

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
