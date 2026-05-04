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
