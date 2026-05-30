from typing import Optional

from fastapi import APIRouter, Query
from ..services.tankerkoenig import service

router = APIRouter()


@router.get("/heatmap")
async def get_heatmap(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
):
    return await service.get_heatmap_data(fuel_type)


@router.get("/best-time")
async def get_best_time(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
):
    return await service.get_best_time(fuel_type)


@router.get("/geo/timeseries")
async def get_geo_timeseries(
    fuel_type: str = Query("diesel", pattern="^(e5|e10|diesel)$"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to today"),
    interval: str = Query("hour", pattern="^(hour|day)$"),
    region: str = Query("bw", pattern="^(bw|all)$"),
):
    """
    Geo-temporal timeseries for the 3D map visualisation.

    Returns one price array per station for the requested date and interval,
    ready to be consumed by the deck.gl ColumnLayer in the frontend.
    """
    return await service.get_geo_timeseries(fuel_type, date, interval, region)
