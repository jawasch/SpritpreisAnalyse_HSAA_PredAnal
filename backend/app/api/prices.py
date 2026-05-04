from fastapi import APIRouter, Query
from ..services.tankerkoenig import service

router = APIRouter()


@router.get("/current")
async def get_current_prices(
    ids: str = Query(..., description="Comma-separated station UUIDs (max 10)"),
):
    station_ids = [s.strip() for s in ids.split(",") if s.strip()][:10]
    return await service.get_prices_for_stations(station_ids)


@router.get("/history")
async def get_price_history(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
    days: int = Query(30, ge=1, le=365),
):
    return await service.get_price_history(fuel_type, days)
