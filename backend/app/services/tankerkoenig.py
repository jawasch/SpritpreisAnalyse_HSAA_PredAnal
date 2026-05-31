"""
TankerkoenigService — single swap point between mock and real data.

Set USE_MOCK_DATA=false in .env and provide TANKERKOENIG_API_KEY to switch
to the live Tankerkönig API without touching any router or frontend code.
"""
import os
import httpx
from typing import Optional

from . import mock_data

_BASE_URL = "https://creativecommons.tankerkoenig.de/json"


class TankerkoenigService:
    def __init__(self):
        self.use_mock = os.getenv("USE_MOCK_DATA", "true").lower() != "false"
        self.api_key = os.getenv("TANKERKOENIG_API_KEY", "")

    # ── Stations ────────────────────────────────────────────────────────────

    async def get_stations_by_radius(
        self,
        lat: float,
        lng: float,
        radius_km: float = 10.0,
        fuel_type: str = "all",
        sort_by: str = "dist",
    ) -> dict:
        if self.use_mock:
            return mock_data.get_stations_by_radius(lat, lng, radius_km, fuel_type, sort_by)
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{_BASE_URL}/list.php",
                params={"lat": lat, "lng": lng, "rad": radius_km, "type": fuel_type, "sort": sort_by, "apikey": self.api_key},
            )
            r.raise_for_status()
            return r.json()

    async def get_station_detail(self, station_id: str) -> dict:
        if self.use_mock:
            return mock_data.get_station_detail(station_id)
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{_BASE_URL}/detail.php", params={"id": station_id, "apikey": self.api_key})
            r.raise_for_status()
            return r.json()

    # ── Prices ──────────────────────────────────────────────────────────────

    async def get_prices_for_stations(self, station_ids: list[str]) -> dict:
        if self.use_mock:
            return mock_data.get_prices_for_stations(station_ids)
        ids_str = ",".join(station_ids[:10])  # TK limit: 10 stations per request
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{_BASE_URL}/prices.php", params={"ids": ids_str, "apikey": self.api_key})
            r.raise_for_status()
            return r.json()

    async def get_price_history(self, fuel_type: str, days: int = 30) -> dict:
        if fuel_type == "diesel":
            try:
                from .ml_service import ml_service
                return ml_service.get_diesel_price_history(days)
            except Exception:
                pass
        return mock_data.get_price_history(fuel_type, days)

    # ── Analytics ───────────────────────────────────────────────────────────

    async def get_heatmap_data(self, fuel_type: str) -> dict:
        try:
            from .ml_service import get_heatmap_from_parquet
            return get_heatmap_from_parquet(fuel_type)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("Heatmap fallback to mock: %s", exc)
            return mock_data.get_heatmap_data(fuel_type)

    async def get_best_time(self, fuel_type: str) -> dict:
        try:
            from .ml_service import get_best_time_from_parquet
            return get_best_time_from_parquet(fuel_type)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("BestTime fallback to mock: %s", exc)
            return mock_data.get_best_time(fuel_type)

    # ── Analytics: Geo-Timeseries ────────────────────────────────────────────

    async def get_geo_timeseries(
        self,
        fuel_type: str = "diesel",
        date: str | None = None,
        interval: str = "hour",
        region: str = "bw",
        scenario: str = "all",
    ) -> dict:
        try:
            from .ml_service import ml_service
            return ml_service.get_geo_timeseries_real(fuel_type, date, interval, scenario)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("GeoTimeseries fallback to mock: %s", exc)
            return mock_data.get_geo_timeseries(fuel_type, date, interval, region)

    # ── Predictions ─────────────────────────────────────────────────────────

    async def get_predictions(self, fuel_type: str, hours: int = 72) -> dict:
        return mock_data.get_predictions(fuel_type, hours)

    async def get_live_prices_for_uuids(self, uuids: list[str]) -> dict[str, float]:
        """Fetch current diesel price for each UUID from the live TK API."""
        if self.use_mock or not self.api_key:
            return {}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(
                    f"{_BASE_URL}/prices.php",
                    params={"ids": ",".join(uuids[:10]), "apikey": self.api_key},
                )
                r.raise_for_status()
                data = r.json()
            return {
                uid: data["prices"][uid]["diesel"]
                for uid in uuids
                if uid in data.get("prices", {})
                and isinstance(data["prices"][uid].get("diesel"), (int, float))
            }
        except Exception:
            return {}

    async def get_spedition_predictions(self) -> dict:
        try:
            from .ml_service import ml_service, ROUTE_META
            uuids = [m["uuid"] for m in ROUTE_META.values()]
            live = await self.get_live_prices_for_uuids(uuids)
            return ml_service.predict_spedition(live_prices=live)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("Spedition ML fallback to mock: %s", exc)
            result = mock_data.get_spedition_predictions()
            result["inference_error"] = str(exc)
            result["data_source"] = "mock_fallback"
            return result

    async def get_b29_predictions(self) -> dict:
        try:
            from .ml_service import ml_service
            return ml_service.predict_b29()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("B29 ML fallback to mock: %s", exc)
            result = mock_data.get_b29_predictions()
            result["inference_error"] = str(exc)
            result["data_source"] = "mock_fallback"
            return result


# Module-level singleton — imported by routers
service = TankerkoenigService()
