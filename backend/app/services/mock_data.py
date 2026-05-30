"""
Mock data generator — produces realistic German fuel price data matching the
Tankerkönig API response format exactly. Swap to real data by toggling
USE_MOCK_DATA=false in .env once the API key is available.
"""
import hashlib
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

# ── Base prices (EUR/L, realistic 2024/25 DE averages) ────────────────────────
BASE_PRICES = {"e5": 1.789, "e10": 1.749, "diesel": 1.629}

BRAND_OFFSET = {
    "Aral": 0.032, "Shell": 0.028, "BP": 0.018, "Esso": 0.014,
    "Agip": 0.015, "Total": 0.005, "AVIA": 0.000, "Westfalen": -0.008,
    "Q1": -0.012, "Star": -0.025, "HEM": -0.032, "JET": -0.038,
}

# hour-of-day offsets (index = hour 0–23)
HOUR_OFFSETS = [
    -0.010, -0.012, -0.014, -0.014, -0.010, -0.005,   # 0–5
     0.010,  0.022,  0.025,  0.020, -0.005, -0.012,   # 6–11
    -0.015, -0.015, -0.010, -0.005,  0.000,  0.008,   # 12–17
     0.012,  0.010,  0.005,  0.000, -0.005, -0.008,   # 18–23
]

# weekday offsets (0=Monday)
WEEKDAY_OFFSETS = [0.012, 0.010, 0.005, 0.000, -0.005, -0.015, -0.018]

# ── 25 realistic stations in the HS-Aalen / Ostalbkreis / Stuttgart region ────
STATIONS = [
    # Aalen
    {"id": "5e1e0b0a-8e6b-4e4b-9c2a-1a2b3c4d5e6f", "name": "Aral Tankstelle Aalen Zentrum", "brand": "Aral", "street": "Stuttgarter Straße", "houseNumber": "125", "postCode": 73430, "place": "Aalen", "lat": 48.8420, "lng": 10.0975},
    {"id": "6f2f1c1b-9f7c-5f5c-0d3b-2b3c4d5e6f7a", "name": "Shell Station Aalen Nord", "brand": "Shell", "street": "Nördlicher Ring", "houseNumber": "38", "postCode": 73431, "place": "Aalen", "lat": 48.8510, "lng": 10.1020},
    {"id": "7a3a2d2c-0a8d-6a6d-1e4c-3c4d5e6f7a8b", "name": "JET Aalen", "brand": "JET", "street": "Ulmer Straße", "houseNumber": "67", "postCode": 73430, "place": "Aalen", "lat": 48.8345, "lng": 10.0889},
    {"id": "8b4b3e3d-1b9e-7b7e-2f5d-4d5e6f7a8b9c", "name": "AVIA Aalen Ost", "brand": "AVIA", "street": "Heidenheimer Straße", "houseNumber": "12", "postCode": 73430, "place": "Aalen", "lat": 48.8298, "lng": 10.1102},
    # Schwäbisch Gmünd
    {"id": "9c5c4f4e-2c0f-8c8f-3a6e-5e6f7a8b9c0d", "name": "Aral Schwäbisch Gmünd", "brand": "Aral", "street": "Gmünder Straße", "houseNumber": "89", "postCode": 73525, "place": "Schwäbisch Gmünd", "lat": 48.8012, "lng": 9.8020},
    {"id": "0d6d5a5f-3d1a-9d9a-4b7f-6f7a8b9c0d1e", "name": "Total Schwäbisch Gmünd", "brand": "Total", "street": "Remsstraße", "houseNumber": "45", "postCode": 73525, "place": "Schwäbisch Gmünd", "lat": 48.7985, "lng": 9.7942},
    # Ellwangen
    {"id": "1e7e6b6a-4e2b-0e0b-5c8a-7a8b9c0d1e2f", "name": "Shell Ellwangen", "brand": "Shell", "street": "Aalener Straße", "houseNumber": "55", "postCode": 73479, "place": "Ellwangen", "lat": 48.9633, "lng": 10.1325},
    {"id": "2f8f7c7b-5f3c-1f1c-6d9b-8b9c0d1e2f3a", "name": "HEM Ellwangen", "brand": "HEM", "street": "Schloßstraße", "houseNumber": "8", "postCode": 73479, "place": "Ellwangen", "lat": 48.9604, "lng": 10.1289},
    # Heidenheim
    {"id": "3a9a8d8c-6a4d-2a2d-7e0c-9c0d1e2f3a4b", "name": "Esso Heidenheim", "brand": "Esso", "street": "Brenzstraße", "houseNumber": "67", "postCode": 89518, "place": "Heidenheim", "lat": 48.6752, "lng": 10.1565},
    {"id": "4b0b9e9d-7b5e-3b3e-8f1d-0d1e2f3a4b5c", "name": "Star Heidenheim", "brand": "Star", "street": "Aalener Straße", "houseNumber": "145", "postCode": 89522, "place": "Heidenheim", "lat": 48.6845, "lng": 10.1612},
    {"id": "5c1c0f0e-8c6f-4c4f-9a2e-1e2f3a4b5c6d", "name": "AVIA Heidenheim Süd", "brand": "AVIA", "street": "Giengenstraße", "houseNumber": "28", "postCode": 89520, "place": "Heidenheim", "lat": 48.6698, "lng": 10.1489},
    # Ulm
    {"id": "6d2d1a1f-9d7a-5d5a-0b3f-2f3a4b5c6d7e", "name": "Aral Ulm Mitte", "brand": "Aral", "street": "Blaubeurer Straße", "houseNumber": "80", "postCode": 89073, "place": "Ulm", "lat": 48.4023, "lng": 9.9901},
    {"id": "7e3e2b2a-0e8b-6e6b-1c4a-3a4b5c6d7e8f", "name": "Shell Ulm Ost", "brand": "Shell", "street": "Münchener Straße", "houseNumber": "143", "postCode": 89075, "place": "Ulm", "lat": 48.3978, "lng": 10.0213},
    {"id": "8f4f3c3b-1f9c-7f7c-2d5b-4b5c6d7e8f9a", "name": "BP Ulm Süd", "brand": "BP", "street": "Stuttgarter Straße", "houseNumber": "97", "postCode": 89079, "place": "Ulm", "lat": 48.3845, "lng": 9.9745},
    {"id": "9a5a4d4c-2a0d-8a8d-3e6c-5c6d7e8f9a0b", "name": "JET Ulm West", "brand": "JET", "street": "Ehinger Straße", "houseNumber": "33", "postCode": 89075, "place": "Ulm", "lat": 48.4125, "lng": 9.9812},
    # Stuttgart
    {"id": "0b6b5e5d-3b1e-9b9e-4f7d-6d7e8f9a0b1c", "name": "Aral Stuttgart Mitte", "brand": "Aral", "street": "Heilbronner Straße", "houseNumber": "180", "postCode": 70191, "place": "Stuttgart", "lat": 48.7889, "lng": 9.1780},
    {"id": "1c7c6f6e-4c2f-0c0f-5a8e-7e8f9a0b1c2d", "name": "Shell Stuttgart West", "brand": "Shell", "street": "Rotebühlstraße", "houseNumber": "121", "postCode": 70178, "place": "Stuttgart", "lat": 48.7712, "lng": 9.1545},
    {"id": "2d8d7a7f-5d3a-1d1a-6b9f-8f9a0b1c2d3e", "name": "BP Stuttgart Ost", "brand": "BP", "street": "Cannstatter Straße", "houseNumber": "46", "postCode": 70190, "place": "Stuttgart", "lat": 48.7845, "lng": 9.2012},
    {"id": "3e9e8b8a-6e4b-2e2b-7c0a-9a0b1c2d3e4f", "name": "Total Stuttgart Süd", "brand": "Total", "street": "Böblinger Straße", "houseNumber": "212", "postCode": 70199, "place": "Stuttgart", "lat": 48.7525, "lng": 9.1698},
    {"id": "4f0f9c9b-7f5c-3f3c-8d1b-0b1c2d3e4f5a", "name": "Esso Stuttgart Nord", "brand": "Esso", "street": "Pragstraße", "houseNumber": "155", "postCode": 70376, "place": "Stuttgart", "lat": 48.8012, "lng": 9.1923},
    {"id": "5a1a0d0c-8a6d-4a4d-9e2c-1c2d3e4f5a6b", "name": "HEM Stuttgart Vaihingen", "brand": "HEM", "street": "Vaihinger Straße", "houseNumber": "73", "postCode": 70567, "place": "Stuttgart", "lat": 48.7398, "lng": 9.1512},
    # Heilbronn
    {"id": "6b2b1e1d-9b7e-5b5e-0f3d-2d3e4f5a6b7c", "name": "Aral Heilbronn", "brand": "Aral", "street": "Frankfurter Straße", "houseNumber": "98", "postCode": 74072, "place": "Heilbronn", "lat": 49.1498, "lng": 9.2178},
    {"id": "7c3c2f2e-0c8f-6c6f-1a4e-3e4f5a6b7c8d", "name": "Shell Heilbronn Süd", "brand": "Shell", "street": "Südstraße", "houseNumber": "34", "postCode": 74074, "place": "Heilbronn", "lat": 49.1312, "lng": 9.2234},
    # A7 Autobahn
    {"id": "8d4d3a3f-1d9a-7d7a-2b5f-4f5a6b7c8d9e", "name": "Aral Autobahn A7 Nord", "brand": "Aral", "street": "Raststätte Illertal West", "houseNumber": "1", "postCode": 89584, "place": "Ehingen", "lat": 48.2845, "lng": 9.7234},
    {"id": "9e5e4b4a-2e0b-8e8b-3c6a-5a6b7c8d9e0f", "name": "Shell Autobahn A7 Süd", "brand": "Shell", "street": "Raststätte Illertal Ost", "houseNumber": "2", "postCode": 89584, "place": "Ehingen", "lat": 48.2789, "lng": 9.7198},
]

_STATION_BY_ID = {s["id"]: s for s in STATIONS}

# ── Spedition scenario: 5 directional stations from Aalen ────────────────────
SPEDITION_STATIONS = [
    {"id": "avia-ipsheim",   "name": "AVIA Ipsheim",    "route": "Nord", "distance_km": 81,  "brand": "AVIA", "lat": 49.2698, "lng": 10.4901},
    {"id": "avia-nuernberg", "name": "AVIA Nürnberg",   "route": "NO",   "distance_km": 90,  "brand": "AVIA", "lat": 49.4521, "lng": 11.0767},
    {"id": "esso-olching",   "name": "ESSO Olching",    "route": "Ost",  "distance_km": 114, "brand": "Esso", "lat": 48.2024, "lng": 11.3308},
    {"id": "ran-biberach",   "name": "RAN Biberach",    "route": "SW",   "distance_km": 86,  "brand": "Star", "lat": 48.0984, "lng": 9.7835},
    {"id": "avia-muehlhsn",  "name": "AVIA Mühlhausen", "route": "NW",   "distance_km": 109, "brand": "AVIA", "lat": 48.9425, "lng": 9.2765},
]
_SPEDITION_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e"]

# ── B29 corridor: 4 geographic cluster definitions ───────────────────────────
B29_CLUSTERS = [
    {"id": "aalen",              "label": "Aalen",       "color": "#3b82f6", "offset": 0.000},
    {"id": "schwaebisch_gmuend", "label": "Schw. Gmünd", "color": "#8b5cf6", "offset": 0.003},
    {"id": "schorndorf",         "label": "Schorndorf",  "color": "#f59e0b", "offset": 0.007},
    {"id": "stuttgart",          "label": "Stuttgart",   "color": "#ef4444", "offset": 0.015},
]

# ── Hardcoded metric arrays from notebook results ────────────────────────────
_SPEDITION_PICK_ACCURACY = [
    {"horizon_h": 1,  "accuracy": 0.61},
    {"horizon_h": 6,  "accuracy": 0.59},
    {"horizon_h": 12, "accuracy": 0.58},
    {"horizon_h": 24, "accuracy": 0.57},
    {"horizon_h": 36, "accuracy": 0.55},
    {"horizon_h": 48, "accuracy": 0.54},
    {"horizon_h": 60, "accuracy": 0.53},
    {"horizon_h": 72, "accuracy": 0.52},
]

_SPEDITION_SPEARMAN = [
    {"horizon_h": 1,  "rho": 0.78},
    {"horizon_h": 6,  "rho": 0.77},
    {"horizon_h": 12, "rho": 0.75},
    {"horizon_h": 24, "rho": 0.72},
    {"horizon_h": 36, "rho": 0.68},
    {"horizon_h": 48, "rho": 0.65},
    {"horizon_h": 60, "rho": 0.63},
    {"horizon_h": 72, "rho": 0.62},
]

_B29_MAE_BY_HORIZON = [
    {"horizon_h": 1,  "mlp_mae": 0.028, "baseline_mae": 0.036},
    {"horizon_h": 6,  "mlp_mae": 0.029, "baseline_mae": 0.037},
    {"horizon_h": 12, "mlp_mae": 0.030, "baseline_mae": 0.038},
    {"horizon_h": 24, "mlp_mae": 0.032, "baseline_mae": 0.041},
    {"horizon_h": 36, "mlp_mae": 0.034, "baseline_mae": 0.043},
    {"horizon_h": 48, "mlp_mae": 0.036, "baseline_mae": 0.045},
    {"horizon_h": 60, "mlp_mae": 0.038, "baseline_mae": 0.048},
    {"horizon_h": 72, "mlp_mae": 0.040, "baseline_mae": 0.050},
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _station_seed(station_id: str, fuel_type: str) -> float:
    """Deterministic per-station price variance: –0.04 … +0.04."""
    h = int(hashlib.md5(f"{station_id}-{fuel_type}".encode()).hexdigest()[:6], 16)
    return (h % 81 - 40) / 1000


def _market_drift(days_ago: float) -> float:
    """Slow sine-wave market movement over a ~30-day cycle (±0.025 EUR)."""
    return math.sin(days_ago * 2 * math.pi / 30) * 0.025


def _calc_price(station: dict, fuel_type: str, dt: datetime) -> float:
    base = BASE_PRICES[fuel_type]
    brand_off = BRAND_OFFSET.get(station["brand"], 0.0)
    station_off = _station_seed(station["id"], fuel_type)
    hour_off = HOUR_OFFSETS[dt.hour]
    weekday_off = WEEKDAY_OFFSETS[dt.weekday()]
    now = datetime.now(timezone.utc)
    days_ago = (now - dt).total_seconds() / 86400
    drift = _market_drift(days_ago)
    price = base + brand_off + station_off + hour_off + weekday_off + drift
    return round(max(price, 1.0), 3)


def _is_open(station_id: str, dt: datetime) -> bool:
    """Simulate opening hours: most stations open 06–22, some 24h."""
    h = int(hashlib.md5(station_id.encode()).hexdigest()[0], 16)
    if h >= 8:  # ~50% are 24h
        return True
    return 6 <= dt.hour < 22


# ── Public API ─────────────────────────────────────────────────────────────────

def get_stations_by_radius(
    lat: float,
    lng: float,
    radius_km: float,
    fuel_type: str = "all",
    sort_by: str = "dist",
) -> dict:
    now = datetime.now(timezone.utc)
    result = []
    for s in STATIONS:
        dist = _haversine_km(lat, lng, s["lat"], s["lng"])
        if dist > radius_km:
            continue
        entry = {**s, "dist": round(dist, 2), "isOpen": _is_open(s["id"], now)}
        for ft in ("e5", "e10", "diesel"):
            if not _is_open(s["id"], now):
                entry[ft] = False
            else:
                entry[ft] = _calc_price(s, ft, now)
        result.append(entry)

    if fuel_type != "all":
        result = [r for r in result if r.get(fuel_type) is not False]
    key = (lambda r: r[fuel_type] if fuel_type != "all" else r["e5"]) if sort_by == "price" else (lambda r: r["dist"])
    result.sort(key=key)
    return {"ok": True, "license": "CC BY 4.0 (mock)", "data": "MTS-K", "stations": result}


def get_prices_for_stations(station_ids: list[str]) -> dict:
    now = datetime.now(timezone.utc)
    prices = {}
    for sid in station_ids:
        s = _STATION_BY_ID.get(sid)
        if not s:
            continue
        open_ = _is_open(sid, now)
        prices[sid] = {
            "status": "open" if open_ else "closed",
            "e5": _calc_price(s, "e5", now) if open_ else False,
            "e10": _calc_price(s, "e10", now) if open_ else False,
            "diesel": _calc_price(s, "diesel", now) if open_ else False,
        }
    return {"ok": True, "license": "CC BY 4.0 (mock)", "data": "MTS-K", "prices": prices}


def get_station_detail(station_id: str) -> dict:
    s = _STATION_BY_ID.get(station_id)
    if not s:
        return {"ok": False, "message": "Station not found"}
    now = datetime.now(timezone.utc)
    open_ = _is_open(station_id, now)
    return {
        "ok": True,
        "station": {
            **s,
            "isOpen": open_,
            "e5": _calc_price(s, "e5", now) if open_ else False,
            "e10": _calc_price(s, "e10", now) if open_ else False,
            "diesel": _calc_price(s, "diesel", now) if open_ else False,
            "openingTimes": [{"text": "Mo-So", "start": "00:00:00", "end": "23:59:00"}],
            "overrides": [],
            "wholeDay": True,
            "state": "Baden-Württemberg",
        },
    }


def get_price_history(fuel_type: str, days: int = 30) -> dict:
    """Daily average prices for the past N days."""
    now = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    data = []
    for d in range(days, -1, -1):
        dt = now - timedelta(days=d)
        prices = [_calc_price(s, fuel_type, dt) for s in STATIONS]
        data.append({
            "timestamp": dt.isoformat(),
            "price": round(sum(prices) / len(prices), 3),
            "min": round(min(prices), 3),
            "max": round(max(prices), 3),
            "station_count": len(STATIONS),
        })
    return {"ok": True, "fuel_type": fuel_type, "data": data}


def get_heatmap_data(fuel_type: str) -> dict:
    """Average price by hour (0–23) × weekday (0=Mon … 6=Sun)."""
    now = datetime.now(timezone.utc)
    cells = []
    all_prices = []
    for weekday in range(7):
        for hour in range(24):
            # Use a representative date with this weekday and hour
            days_back = (now.weekday() - weekday) % 7
            dt = (now - timedelta(days=days_back)).replace(hour=hour, minute=0, second=0, microsecond=0)
            prices = [_calc_price(s, fuel_type, dt) for s in STATIONS]
            avg = round(sum(prices) / len(prices), 3)
            cells.append({"hour": hour, "weekday": weekday, "avg_price": avg})
            all_prices.append(avg)

    overall_avg = sum(all_prices) / len(all_prices)
    for cell in cells:
        cell["relative"] = round(cell["avg_price"] - overall_avg, 3)
    return {"ok": True, "fuel_type": fuel_type, "overall_avg": round(overall_avg, 3), "data": cells}


def get_best_time(fuel_type: str) -> dict:
    result = get_heatmap_data(fuel_type)
    cells = result["data"]
    overall_avg = result["overall_avg"]
    best = min(cells, key=lambda c: c["avg_price"])
    worst = max(cells, key=lambda c: c["avg_price"])
    savings = round(worst["avg_price"] - best["avg_price"], 3)

    day_names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    insight = (
        f"{day_names[best['weekday']]}s zwischen {best['hour']}:00 und {best['hour']+1}:00 Uhr "
        f"sind die Preise am günstigsten ({best['avg_price']:.3f} EUR/L)."
    )
    return {
        "ok": True,
        "fuel_type": fuel_type,
        "best_hour": best["hour"],
        "best_weekday": best["weekday"],
        "avg_price_best": best["avg_price"],
        "avg_price_worst": worst["avg_price"],
        "avg_price_overall": overall_avg,
        "potential_savings_eur": savings,
        "potential_savings_percent": round(savings / overall_avg * 100, 2),
        "insight": insight,
    }


def get_geo_timeseries(
    fuel_type: str = "diesel",
    date: str | None = None,
    interval: str = "hour",
    region: str = "bw",
) -> dict:
    """
    Hourly (or daily) price timeseries for all mock stations on a given date.

    Response shape consumed by the frontend GeoPriceMap3D component:
    {
      "stations": [{ "id", "name", "brand", "lat", "lng", "prices": [{timestamp, price}] }],
      "meta": { "fuel_type", "date", "interval" }
    }
    """
    from datetime import date as date_cls

    if date is None:
        ref_date = datetime.now(timezone.utc).date()
    else:
        ref_date = date_cls.fromisoformat(date)

    if interval == "hour":
        n_steps = 24
        delta = timedelta(hours=1)
    else:  # day — last 30 days
        n_steps = 30
        delta = timedelta(days=1)
        ref_date = ref_date - timedelta(days=n_steps - 1)

    stations_out = []
    for s in STATIONS:
        prices = []
        for step in range(n_steps):
            dt = datetime(
                ref_date.year, ref_date.month, ref_date.day,
                tzinfo=timezone.utc,
            ) + step * delta
            price = _calc_price(s, fuel_type, dt)
            prices.append({"timestamp": dt.isoformat(), "price": price})

        stations_out.append({
            "id": s["id"],
            "name": s["name"],
            "brand": s["brand"],
            "lat": s["lat"],
            "lng": s["lng"],
            "prices": prices,
        })

    return {
        "ok": True,
        "stations": stations_out,
        "meta": {
            "fuel_type": fuel_type,
            "date": ref_date.isoformat(),
            "interval": interval,
            "n_stations": len(stations_out),
        },
    }


def get_spedition_predictions() -> dict:
    """72-hour diesel forecast for the 5 Spedition route stations."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    stations_out = []
    for i, s in enumerate(SPEDITION_STATIONS):
        forecast = []
        for h in range(73):
            dt = now + timedelta(hours=h)
            price = _calc_price(s, "diesel", dt)
            forecast.append({"hour_offset": h, "predicted_price": price})
        stations_out.append({
            "id": s["id"],
            "name": s["name"],
            "route": s["route"],
            "distance_km": s["distance_km"],
            "color": _SPEDITION_COLORS[i],
            "forecast": forecast,
        })

    recommendations = []
    for i, s_out in enumerate(stations_out):
        current = s_out["forecast"][0]["predicted_price"]
        best = min(s_out["forecast"], key=lambda f: f["predicted_price"])
        optimal_dt = now + timedelta(hours=best["hour_offset"])
        recommendations.append({
            "route": SPEDITION_STATIONS[i]["route"],
            "station_name": s_out["name"],
            "distance_km": s_out["distance_km"],
            "current_price": current,
            "predicted_best_price": best["predicted_price"],
            "best_hour_offset": best["hour_offset"],
            "optimal_time_label": f"{optimal_dt.strftime('%d.%m. %H:%M')} Uhr",
            "savings_vs_now": round(current - best["predicted_price"], 4),
        })
    recommendations.sort(key=lambda r: r["current_price"])

    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "model": {
            "name": "Spedition MLP",
            "architecture": "101→[256,128]→360",
            "mae": 0.0377,
            "r2": 0.928,
            "spearman_avg": 0.75,
            "pick_accuracy_t1": 0.61,
            "baseline_pick_accuracy": 0.20,
        },
        "savings": {"per_day_eur": 17.0, "per_year_eur": 6205.0, "trucks": 5},
        "recommendations": recommendations,
        "stations": stations_out,
        "pick_accuracy_by_horizon": _SPEDITION_PICK_ACCURACY,
        "spearman_by_horizon": _SPEDITION_SPEARMAN,
    }


def get_b29_predictions() -> dict:
    """72-hour diesel forecast for the 4 B29 corridor clusters."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    synthetic_base = {"id": "b29-base", "brand": "AVIA"}

    clusters_out = []
    for c in B29_CLUSTERS:
        forecast = []
        for h in range(73):
            dt = now + timedelta(hours=h)
            price = round(_calc_price(synthetic_base, "diesel", dt) + c["offset"], 3)
            forecast.append({"hour_offset": h, "predicted_price": price})
        clusters_out.append({
            "id": c["id"],
            "label": c["label"],
            "color": c["color"],
            "forecast": forecast,
        })

    recommendations = []
    for c_out in clusters_out:
        current = c_out["forecast"][0]["predicted_price"]
        best = min(c_out["forecast"], key=lambda f: f["predicted_price"])
        optimal_dt = now + timedelta(hours=best["hour_offset"])
        recommendations.append({
            "cluster": c_out["label"],
            "cluster_id": c_out["id"],
            "current_price": current,
            "predicted_best_price": best["predicted_price"],
            "optimal_hour_offset": best["hour_offset"],
            "optimal_time_label": f"{optimal_dt.strftime('%d.%m. %H:%M')} Uhr",
            "savings_vs_now": round(current - best["predicted_price"], 4),
        })
    recommendations.sort(key=lambda r: r["current_price"])

    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "model": {
            "name": "B29 Fleet MLP",
            "architecture": "80→[256,128]→288",
            "mae": 0.031,
            "mae_improvement_pct": 23.0,
            "r2": 0.93,
        },
        "savings": {"per_day_eur": 187.50, "per_year_eur": 46875.0, "trucks": 25},
        "recommendations": recommendations,
        "clusters": clusters_out,
        "mae_by_horizon": _B29_MAE_BY_HORIZON,
    }


def get_predictions(fuel_type: str, hours: int = 72) -> dict:
    """Simple rule-based 72-hour forecast with widening confidence intervals."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    current_prices = [_calc_price(s, fuel_type, now) for s in STATIONS]
    current_avg = sum(current_prices) / len(current_prices)

    predictions = []
    for h in range(hours + 1):
        dt = now + timedelta(hours=h)
        base = BASE_PRICES[fuel_type]
        brand_avg = sum(BRAND_OFFSET.get(s["brand"], 0) for s in STATIONS) / len(STATIONS)
        hour_off = HOUR_OFFSETS[dt.hour]
        weekday_off = WEEKDAY_OFFSETS[dt.weekday()]
        predicted = round(base + brand_avg + hour_off + weekday_off, 3)

        # Confidence widens linearly with forecast horizon
        uncertainty = round(0.005 + h * 0.0008, 4)
        predictions.append({
            "timestamp": dt.isoformat(),
            "predicted_price": predicted,
            "confidence_lower": round(predicted - uncertainty, 3),
            "confidence_upper": round(predicted + uncertainty, 3),
        })

    return {
        "ok": True,
        "fuel_type": fuel_type,
        "current_price": round(current_avg, 3),
        "generated_at": now.isoformat(),
        "predictions": predictions,
    }
