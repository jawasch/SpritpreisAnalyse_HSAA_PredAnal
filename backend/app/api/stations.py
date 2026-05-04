from fastapi import APIRouter, Query, HTTPException
from ..services.tankerkoenig import service

router = APIRouter()


@router.get("/nearby")
async def get_nearby_stations(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
    rad: float = Query(10.0, gt=0, le=25, description="Radius in km"),
    type: str = Query("all", pattern="^(e5|e10|diesel|all)$"),
    sort: str = Query("dist", pattern="^(dist|price)$"),
):
    return await service.get_stations_by_radius(lat, lng, rad, type, sort)


@router.get("/{station_id}")
async def get_station_detail(station_id: str):
    result = await service.get_station_detail(station_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail="Station not found")
    return result
