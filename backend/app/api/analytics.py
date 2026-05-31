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
    scenario: str = Query("all", pattern="^(all|spedition|b29|germany)$"),
):
    """
    Geo-temporal timeseries for the 3D map visualisation.

    scenario="all"       — All 15k German stations (estimated prices from parquet)
    scenario="spedition" — 5 Spedition route stations with MLP-predicted 24h prices
    scenario="b29"       — 4 B29 cluster centroids with MLP-predicted 24h prices
    scenario="germany"   — National grid model (falls back to "all" if not trained yet)
    """
    return await service.get_geo_timeseries(fuel_type, date, interval, region, scenario)
