"""Integration tests for all FastAPI endpoints."""
import pytest


class TestRoot:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "online"

    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert "status" in r.json()


class TestStationsEndpoints:
    def test_nearby_default_sort(self, client):
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 25})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert len(data["stations"]) > 0

    def test_nearby_sort_by_price(self, client):
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 25, "type": "e5", "sort": "price"})
        assert r.status_code == 200
        prices = [s["e5"] for s in r.json()["stations"] if s["e5"] is not False]
        assert prices == sorted(prices)

    def test_nearby_small_radius(self, client):
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 1})
        assert r.status_code == 200
        for s in r.json()["stations"]:
            assert s["dist"] <= 1.0

    def test_nearby_invalid_lat(self, client):
        r = client.get("/api/v1/stations/nearby", params={"lat": 999, "lng": 10.0931})
        assert r.status_code == 422

    def test_nearby_radius_too_large(self, client):
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 100})
        assert r.status_code == 422

    def test_station_detail_not_found(self, client):
        r = client.get("/api/v1/stations/nonexistent-id")
        assert r.status_code == 404

    def test_station_detail_found(self, client):
        # Get a valid ID from nearby first
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 25})
        station_id = r.json()["stations"][0]["id"]
        r2 = client.get(f"/api/v1/stations/{station_id}")
        assert r2.status_code == 200
        assert r2.json()["ok"] is True


class TestPricesEndpoints:
    def _get_station_ids(self, client, n=3):
        r = client.get("/api/v1/stations/nearby", params={"lat": 48.8375, "lng": 10.0931, "rad": 25})
        return [s["id"] for s in r.json()["stations"][:n]]

    def test_current_prices(self, client):
        ids = self._get_station_ids(client)
        r = client.get("/api/v1/prices/current", params={"ids": ",".join(ids)})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert len(data["prices"]) == len(ids)

    def test_current_prices_missing_ids(self, client):
        r = client.get("/api/v1/prices/current")
        assert r.status_code == 422

    def test_history_e5(self, client):
        r = client.get("/api/v1/prices/history", params={"fuel_type": "e5", "days": 7})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert len(data["data"]) == 8  # days + 1

    def test_history_diesel(self, client):
        r = client.get("/api/v1/prices/history", params={"fuel_type": "diesel", "days": 14})
        assert r.status_code == 200
        assert len(r.json()["data"]) == 15

    def test_history_invalid_fuel_type(self, client):
        r = client.get("/api/v1/prices/history", params={"fuel_type": "benzin"})
        assert r.status_code == 422

    def test_history_days_too_large(self, client):
        r = client.get("/api/v1/prices/history", params={"fuel_type": "e5", "days": 9999})
        assert r.status_code == 422


class TestAnalyticsEndpoints:
    def test_heatmap(self, client):
        r = client.get("/api/v1/analytics/heatmap", params={"fuel_type": "e5"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert len(data["data"]) == 168  # 24 × 7

    def test_heatmap_all_fuel_types(self, client):
        for ft in ("e5", "e10", "diesel"):
            r = client.get("/api/v1/analytics/heatmap", params={"fuel_type": ft})
            assert r.status_code == 200, f"Failed for {ft}"

    def test_best_time(self, client):
        r = client.get("/api/v1/analytics/best-time", params={"fuel_type": "e5"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert "best_hour" in data
        assert "insight" in data
        assert 0 <= data["best_hour"] <= 23
        assert 0 <= data["best_weekday"] <= 6


class TestPredictionsEndpoints:
    def test_short_term_default(self, client):
        r = client.get("/api/v1/predictions/short-term", params={"fuel_type": "e5"})
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert len(data["predictions"]) == 73  # 72 + 1

    def test_short_term_custom_hours(self, client):
        r = client.get("/api/v1/predictions/short-term", params={"fuel_type": "diesel", "hours": 24})
        assert r.status_code == 200
        assert len(r.json()["predictions"]) == 25

    def test_short_term_hours_too_large(self, client):
        r = client.get("/api/v1/predictions/short-term", params={"fuel_type": "e5", "hours": 999})
        assert r.status_code == 422

    def test_confidence_band_present(self, client):
        r = client.get("/api/v1/predictions/short-term", params={"fuel_type": "e5", "hours": 12})
        for p in r.json()["predictions"]:
            assert p["confidence_lower"] <= p["predicted_price"] <= p["confidence_upper"]
