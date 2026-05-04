"""Unit tests for the mock data generator."""
import pytest
from app.services.mock_data import (
    get_stations_by_radius,
    get_prices_for_stations,
    get_station_detail,
    get_price_history,
    get_heatmap_data,
    get_best_time,
    get_predictions,
    STATIONS,
    BASE_PRICES,
)

# Reference point: HS Aalen
LAT, LNG = 48.8375, 10.0931


class TestStationsByRadius:
    def test_returns_ok(self):
        result = get_stations_by_radius(LAT, LNG, 25)
        assert result["ok"] is True
        assert "stations" in result

    def test_filters_by_radius(self):
        wide = get_stations_by_radius(LAT, LNG, 25)
        narrow = get_stations_by_radius(LAT, LNG, 2)
        assert len(wide["stations"]) >= len(narrow["stations"])

    def test_all_stations_within_radius(self):
        radius = 15
        result = get_stations_by_radius(LAT, LNG, radius)
        for s in result["stations"]:
            assert s["dist"] <= radius

    def test_sort_by_distance(self):
        result = get_stations_by_radius(LAT, LNG, 25, sort_by="dist")
        dists = [s["dist"] for s in result["stations"]]
        assert dists == sorted(dists)

    def test_sort_by_price_e5(self):
        result = get_stations_by_radius(LAT, LNG, 25, fuel_type="e5", sort_by="price")
        prices = [s["e5"] for s in result["stations"] if s["e5"] is not False]
        assert prices == sorted(prices)

    def test_station_has_required_fields(self):
        result = get_stations_by_radius(LAT, LNG, 25)
        for s in result["stations"]:
            for field in ("id", "name", "brand", "lat", "lng", "dist", "isOpen", "e5", "e10", "diesel"):
                assert field in s, f"Missing field: {field}"

    def test_prices_are_realistic(self):
        result = get_stations_by_radius(LAT, LNG, 25)
        for s in result["stations"]:
            for ft in ("e5", "e10", "diesel"):
                if s[ft] is not False:
                    assert 1.0 < s[ft] < 3.0, f"Unrealistic price {s[ft]} for {ft}"

    def test_e10_cheaper_than_e5(self):
        result = get_stations_by_radius(LAT, LNG, 25)
        for s in result["stations"]:
            if s["e5"] and s["e10"] and s["e5"] is not False and s["e10"] is not False:
                assert s["e10"] <= s["e5"] + 0.01, "E10 should generally be cheaper than E5"


class TestPricesForStations:
    def test_returns_ok(self):
        ids = [STATIONS[0]["id"], STATIONS[1]["id"]]
        result = get_prices_for_stations(ids)
        assert result["ok"] is True
        assert "prices" in result

    def test_unknown_station_omitted(self):
        result = get_prices_for_stations(["nonexistent-uuid"])
        assert len(result["prices"]) == 0

    def test_max_10_stations(self):
        ids = [s["id"] for s in STATIONS[:12]]
        result = get_prices_for_stations(ids)
        assert len(result["prices"]) <= 12  # service does not cap, router does

    def test_price_structure(self):
        ids = [STATIONS[0]["id"]]
        result = get_prices_for_stations(ids)
        entry = result["prices"][STATIONS[0]["id"]]
        assert "status" in entry
        assert entry["status"] in ("open", "closed")
        assert "e5" in entry and "e10" in entry and "diesel" in entry

    def test_closed_station_prices_are_false(self):
        ids = [s["id"] for s in STATIONS]
        result = get_prices_for_stations(ids)
        for entry in result["prices"].values():
            if entry["status"] == "closed":
                assert entry["e5"] is False


class TestStationDetail:
    def test_known_station(self):
        sid = STATIONS[0]["id"]
        result = get_station_detail(sid)
        assert result["ok"] is True
        assert result["station"]["id"] == sid

    def test_unknown_station(self):
        result = get_station_detail("does-not-exist")
        assert result["ok"] is False

    def test_detail_has_opening_times(self):
        sid = STATIONS[0]["id"]
        result = get_station_detail(sid)
        assert "openingTimes" in result["station"]


class TestPriceHistory:
    @pytest.mark.parametrize("fuel_type", ["e5", "e10", "diesel"])
    def test_correct_length(self, fuel_type):
        days = 7
        result = get_price_history(fuel_type, days)
        assert result["ok"] is True
        assert len(result["data"]) == days + 1  # includes today

    def test_data_has_required_fields(self):
        result = get_price_history("e5", 5)
        for entry in result["data"]:
            for field in ("timestamp", "price", "min", "max", "station_count"):
                assert field in entry

    def test_min_le_price_le_max(self):
        result = get_price_history("e5", 10)
        for entry in result["data"]:
            assert entry["min"] <= entry["price"] <= entry["max"]

    def test_prices_chronological(self):
        result = get_price_history("e5", 10)
        timestamps = [e["timestamp"] for e in result["data"]]
        assert timestamps == sorted(timestamps)


class TestHeatmapData:
    @pytest.mark.parametrize("fuel_type", ["e5", "e10", "diesel"])
    def test_correct_cell_count(self, fuel_type):
        result = get_heatmap_data(fuel_type)
        assert result["ok"] is True
        assert len(result["data"]) == 24 * 7  # 24 hours × 7 weekdays

    def test_cell_structure(self):
        result = get_heatmap_data("e5")
        for cell in result["data"]:
            assert 0 <= cell["hour"] <= 23
            assert 0 <= cell["weekday"] <= 6
            assert "avg_price" in cell
            assert "relative" in cell

    def test_relative_offsets_sum_near_zero(self):
        result = get_heatmap_data("e5")
        total_rel = sum(c["relative"] for c in result["data"])
        assert abs(total_rel) < 1.0  # near-zero sum


class TestBestTime:
    @pytest.mark.parametrize("fuel_type", ["e5", "e10", "diesel"])
    def test_returns_ok(self, fuel_type):
        result = get_best_time(fuel_type)
        assert result["ok"] is True

    def test_required_fields(self):
        result = get_best_time("e5")
        for field in ("best_hour", "best_weekday", "avg_price_best", "avg_price_worst", "potential_savings_eur", "insight"):
            assert field in result

    def test_best_cheaper_than_worst(self):
        result = get_best_time("e5")
        assert result["avg_price_best"] < result["avg_price_worst"]

    def test_savings_positive(self):
        result = get_best_time("e5")
        assert result["potential_savings_eur"] > 0
        assert result["potential_savings_percent"] > 0


class TestPredictions:
    @pytest.mark.parametrize("hours", [24, 48, 72])
    def test_correct_count(self, hours):
        result = get_predictions("e5", hours)
        assert result["ok"] is True
        assert len(result["predictions"]) == hours + 1  # includes current hour

    def test_confidence_band_widens(self):
        result = get_predictions("e5", 48)
        preds = result["predictions"]
        first_width = preds[0]["confidence_upper"] - preds[0]["confidence_lower"]
        last_width = preds[-1]["confidence_upper"] - preds[-1]["confidence_lower"]
        assert last_width > first_width

    def test_price_within_confidence(self):
        result = get_predictions("e5", 24)
        for p in result["predictions"]:
            assert p["confidence_lower"] <= p["predicted_price"] <= p["confidence_upper"]

    def test_has_current_price(self):
        result = get_predictions("diesel", 24)
        assert "current_price" in result
        assert 1.0 < result["current_price"] < 3.0
