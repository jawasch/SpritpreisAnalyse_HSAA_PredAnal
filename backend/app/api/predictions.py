from fastapi import APIRouter, Query
from ..services.tankerkoenig import service

router = APIRouter()


@router.get("/short-term")
async def get_short_term_predictions(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
    hours: int = Query(72, ge=1, le=168),
):
    return await service.get_predictions(fuel_type, hours)
