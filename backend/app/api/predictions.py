import logging
import traceback

from fastapi import APIRouter, HTTPException, Query

from ..services.tankerkoenig import service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/short-term")
async def get_short_term_predictions(
    fuel_type: str = Query("e5", pattern="^(e5|e10|diesel)$"),
    hours: int = Query(72, ge=1, le=168),
):
    return await service.get_predictions(fuel_type, hours)


@router.get("/spedition")
async def get_spedition_predictions():
    try:
        return await service.get_spedition_predictions()
    except Exception as exc:
        logger.error("Spedition inference failed:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"ML inference error: {exc}. Check backend logs.",
        )


@router.get("/b29")
async def get_b29_predictions():
    try:
        return await service.get_b29_predictions()
    except Exception as exc:
        logger.error("B29 inference failed:\n%s", traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"ML inference error: {exc}. Check backend logs.",
        )
