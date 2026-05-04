# 📋 Issues - Spritpreis Analytics Dashboard

Letzte Aktualisierung: Mai 2026

---

## 📊 Aktueller Projektstand

| Phase | Status | Fortschritt |
|-------|--------|-------------|
| Phase 1: Dateninfrastruktur | 🟡 In Bearbeitung | 2/6 abgeschlossen |
| Phase 2: Backend Development | ✅ Abgeschlossen | 4/4 abgeschlossen |
| Phase 3: ML Pipeline | ⬜ Ausstehend | 0/6 abgeschlossen |
| Phase 4: Frontend Development | ✅ Abgeschlossen | 7/7 abgeschlossen |
| Phase 5: Integration & Testing | 🟡 In Bearbeitung | 2/3 abgeschlossen |
| Phase 6: Analyse & Dokumentation | ⬜ Ausstehend | 0/4 abgeschlossen |

---

## 🚦 Nächste Prioritäten

1. **Tankerkönig API-Key** abwarten → `USE_MOCK_DATA=false` in `.env` setzen → fertig
2. **Issue #5**: Historische Daten importieren (CSV-Pipeline)
3. **Issue #6**: Explorative Datenanalyse in Jupyter
4. **Issue #4**: EIA Rohölpreise integrieren
5. **Issue #10**: Scheduled Jobs (stündlicher Datenabruf)
6. **Issue #11–15**: ML-Pipeline (Prophet → LSTM → ARIMA)

---

## 🔴 PHASE 1: Dateninfrastruktur

### Issue #1: API-Keys beantragen und Datenquellen Setup
**Status**: 🟡 In Bearbeitung — Tankerkönig API-Key beantragt, Genehmigung ausstehend  
**Priority**: High | **Labels**: setup, data-sources

**Tasks:**
- [x] Tankerkönig API-Key beantragt (https://creativecommons.tankerkoenig.de)
- [ ] Tankerkönig API-Key erhalten und in `.env` eingetragen
- [ ] EIA API-Key beantragt (https://www.eia.gov/opendata/)
- [ ] Historische Tankerkönig-Daten angefordert (CSV-Repository)
- [ ] API-Verbindungen getestet (→ `USE_MOCK_DATA=false`)

**Hinweis:** `TankerkoenigService` in `backend/app/services/tankerkoenig.py` ist vollständig vorbereitet. Sobald der Key da ist, nur `USE_MOCK_DATA=false` in `.env` setzen.

---

### Issue #2: PostgreSQL Datenbank-Schema Design
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: database, architecture

**Tasks:**
- [x] SQLAlchemy Models: `GasStation`, `FuelPrice`, `CrudeOilPrice`, `PoliticalEvent`, `Prediction`, `ModelMetadata`
- [x] Pydantic Schemas für alle Models
- [x] Performance-Indizes definiert
- [ ] Alembic Initialmigration erstellen (`make migration MSG="initial schema"`)
- [ ] Migration gegen Live-DB ausführen

---

### Issue #3: Tankerkönig API Integration
**Status**: 🟡 Mock-Betrieb aktiv — Real-Betrieb vorbereitet  
**Priority**: High | **Labels**: integration, data-fetcher

**Tasks:**
- [x] `TankerkoenigService` Klasse erstellt (`backend/app/services/tankerkoenig.py`)
- [x] Mock-Datengenerator mit realistischen DE-Tankstellen (25 Stationen, Ostalbkreis/Stuttgart/Ulm)
- [x] `get_stations_by_radius()` implementiert (mock + real)
- [x] `get_prices_for_stations()` implementiert (mock + real)
- [x] `get_station_detail()` implementiert (mock + real)
- [x] Preis-Muster: Uhrzeiten, Wochentage, Marken-Offsets, Marktdrift
- [ ] Rate-Limiting (1 req/min) für Real-Betrieb implementieren
- [ ] Real-API-Verbindung testen sobald Key vorhanden

---

### Issue #4: EIA API Integration für Rohölpreise
**Status**: ⬜ Ausstehend  
**Priority**: High | **Labels**: integration, data-fetcher

**Tasks:**
- [ ] `EIAService` Klasse erstellen (`backend/app/services/eia.py`)
- [ ] `get_brent_crude_prices()` und `get_wti_crude_prices()`
- [ ] USD/Barrel → EUR/Liter Umrechnung
- [ ] Scheduled Job für täglichen Import
- [ ] Frontend-Integration (Rohölpreis-Overlay im Analytics-Chart)

---

### Issue #5: Daten-Import Pipeline für historische Daten
**Status**: ⬜ Ausstehend  
**Priority**: High | **Labels**: data-pipeline, ETL

**Tasks:**
- [ ] CSV-Parser für Tankerkönig-Format (`backend/scripts/import_historical.py`)
- [ ] Batch-Import mit Progress-Anzeige
- [ ] Duplikatserkennung (unique constraint auf station_id + timestamp)
- [ ] Datenvalidierung und Cleaning
- [ ] `make import` Shortcut im Makefile

---

### Issue #6: Explorative Datenanalyse (EDA)
**Status**: ⬜ Ausstehend — wartet auf historische Daten  
**Priority**: Medium | **Labels**: data-science, jupyter

**Tasks:**
- [ ] `notebooks/01_data_exploration.ipynb`
- [ ] `notebooks/02_time_patterns.ipynb`
- [ ] `notebooks/03_regional_analysis.ipynb`
- [ ] `notebooks/04_correlation_crude_oil.ipynb`
- [ ] `notebooks/05_policy_events.ipynb`

---

## 🟠 PHASE 2: Backend Development

### Issue #7: FastAPI Routen-Architektur
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: backend, api

- [x] `backend/app/api/stations.py` — `/api/v1/stations/nearby`, `/{id}`
- [x] `backend/app/api/prices.py` — `/api/v1/prices/current`, `/history`
- [x] `backend/app/api/analytics.py` — `/api/v1/analytics/heatmap`, `/best-time`
- [x] `backend/app/api/predictions.py` — `/api/v1/predictions/short-term`
- [x] Swagger UI unter `http://localhost:8000/docs`

---

### Issue #8: Prices API Endpoints
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: backend, api, prices

- [x] `GET /api/v1/prices/current?ids=`
- [x] `GET /api/v1/prices/history?fuel_type=&days=`
- [x] Query-Parameter Validierung (Pydantic / FastAPI)

---

### Issue #9: Stations API Endpoints
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: backend, api, stations

- [x] `GET /api/v1/stations/nearby?lat=&lng=&rad=&type=&sort=`
- [x] `GET /api/v1/stations/{station_id}`
- [x] Geo-Suche (Haversine-Formel)
- [x] Sortierung nach Entfernung und Preis

---

### Issue #10: Scheduled Jobs Implementation
**Status**: ⬜ Ausstehend — wartet auf Real-API  
**Priority**: Medium | **Labels**: backend, scheduler

**Tasks:**
- [ ] APScheduler in `backend/app/services/scheduler.py` einrichten
- [ ] `fetch_current_prices_job` — stündlich
- [ ] `fetch_oil_prices_job` — täglich
- [ ] `retrain_models_job` — wöchentlich
- [ ] Job-Status-Endpoint `GET /api/v1/admin/jobs`

---

## 🟡 PHASE 3: ML Pipeline

### Issue #11: Feature Engineering Pipeline
**Status**: ⬜ Ausstehend  
**Priority**: High | **Labels**: ml, data-science

- [ ] `backend/app/ml/features.py` — `FeatureEngineer` Klasse
- [ ] Zeitbasierte Features (Stunde, Wochentag, Monat, zyklisch sin/cos)
- [ ] Lag-Features (1h, 6h, 24h, 7d)
- [ ] Rolling Statistics (MA 7d, 30d, Volatilität)
- [ ] Externe Features (Rohölpreis, Wechselkurs)

---

### Issue #12: Prophet Forecasting Model
**Status**: ⬜ Ausstehend  
**Priority**: High | **Labels**: ml, prophet

- [ ] `backend/app/ml/prophet_model.py`
- [ ] Hyperparameter-Tuning, Feiertage-Integration
- [ ] MAPE-Ziel: < 10 % auf Test-Set
- [ ] Model-Persistierung (Pickle)

---

### Issue #13: LSTM Deep Learning Model
**Status**: ⬜ Ausstehend  
**Priority**: Medium | **Labels**: ml, tensorflow

- [ ] `backend/app/ml/lstm_model.py`
- [ ] LSTM-Architektur (2–3 Layer, Dropout)
- [ ] EarlyStopping, ModelCheckpoint Callbacks
- [ ] Inference-Ziel: < 100 ms

---

### Issue #14: ARIMA/SARIMAX Statistical Model
**Status**: ⬜ Ausstehend  
**Priority**: Medium | **Labels**: ml, statistics

- [ ] `backend/app/ml/arima_model.py`
- [ ] Stationaritäts-Tests (ADF, KPSS)
- [ ] SARIMAX mit exogenen Variablen (Rohöl)

---

### Issue #15: Model Evaluation Framework
**Status**: ⬜ Ausstehend  
**Priority**: Medium | **Labels**: ml, evaluation

- [ ] `backend/app/ml/evaluator.py` — RMSE, MAE, MAPE, R²
- [ ] Backtesting auf historischen Daten
- [ ] Model-Comparison-Report

---

### Issue #16: Prediction Service Integration
**Status**: 🟡 Mock-Implementierung aktiv  
**Priority**: High | **Labels**: ml, backend, api

- [x] `GET /api/v1/predictions/short-term` — regelbasierte Mock-Prognose mit Konfidenzband
- [ ] Echte ML-Modelle laden (Prophet, LSTM, ARIMA)
- [ ] Ensemble-Prognose (Weighted Average)
- [ ] Async-Processing für lange Berechnungen

---

## 🔵 PHASE 4: Frontend Development

### Issue #17: React Project Setup & Architecture
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: frontend, react, setup

- [x] Vite + React 18, React Router v6
- [x] Tailwind CSS + PostCSS konfiguriert
- [x] D3 v7, Leaflet/React-Leaflet eingebunden
- [x] Axios API-Service-Layer

---

### Issue #18: Dashboard Main Component
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: frontend, dashboard

- [x] Preiskarten E5 / E10 / Diesel mit Tagesdelta
- [x] „Beste Tankzeit"-Empfehlung
- [x] 30-Tage Preisentwicklungs-Chart
- [x] Nahgelegene Tankstellen-Tabelle

---

### Issue #19: D3.js Price Chart Components
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: frontend, d3js

- [x] `PriceLineChart.jsx` — Multi-Serie Zeitreihe mit Tooltip
- [x] `PredictionChart.jsx` — Prognose mit Konfidenzband, „Jetzt"-Marker

---

### Issue #20: Heatmap für Uhrzeitanalyse
**Status**: ✅ Abgeschlossen  
**Priority**: Medium | **Labels**: frontend, d3js

- [x] `TimeHeatmap.jsx` — 24 h × 7 Wochentage, Farbskala grün→rot
- [x] Tooltip mit Preis und Abweichung vom Durchschnitt
- [x] Farblegend

---

### Issue #21: Interactive Map Component
**Status**: ✅ Abgeschlossen  
**Priority**: Medium | **Labels**: frontend, maps

- [x] `StationMap.jsx` — React-Leaflet mit OpenStreetMap
- [x] Farbkodierte Marker (grün=günstig, rot=teuer)
- [x] Popup mit allen Kraftstoffpreisen und Öffnungsstatus
- [x] Suchradius-Kreis

---

### Issue #22: Policy Impact Timeline
**Status**: ⬜ Ausstehend  
**Priority**: Low | **Labels**: frontend, visualization

- [ ] `PolicyTimeline.jsx` — D3 Timeline für politische Ereignisse
- [ ] Vorher/Nachher-Preisvergleich
- [ ] Statistische Signifikanz-Indikator

---

### Issue #23: API Service Layer (Frontend)
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: frontend, api

- [x] `frontend/src/services/api.js` — Axios-Client mit Basis-URL
- [x] Alle Endpunkte: stations, prices, analytics, predictions
- [x] Zentrale Konstanten: `FUEL_COLORS`, `FUEL_LABELS`, `WEEKDAY_LABELS`

---

## 🟢 PHASE 5: Integration & Testing

### Issue #24: End-to-End Integration
**Status**: ✅ Abgeschlossen (Mock-Betrieb)  
**Priority**: High | **Labels**: integration

- [x] Frontend ↔ Backend vollständig verbunden (alle 4 Seiten)
- [x] Fehlerbehandlung und Loading-States im Frontend
- [ ] Re-Test mit echten Tankerkönig-Daten

---

### Issue #25: Docker Setup & Containerization
**Status**: ✅ Abgeschlossen  
**Priority**: High | **Labels**: docker, devops

- [x] `Dockerfile` Backend + Frontend
- [x] `docker-compose.yml` — db, backend, frontend, pgAdmin (dev-Profile)
- [x] Health-Check auf PostgreSQL
- [x] Volume-Mapping für Hot-Reload
- [x] `Makefile` mit `make dev`, `make test`, `make shell-db`, `make migration` u.v.m.

---

### Issue #26: Testing & Test Coverage
**Status**: 🟡 Backend abgeschlossen — Frontend ausstehend  
**Priority**: Medium | **Labels**: testing, quality

- [x] `backend/tests/conftest.py` — Session-scoped TestClient
- [x] `backend/tests/test_mock_data.py` — Unit-Tests (mock data generator)
- [x] `backend/tests/test_api.py` — Integrations-Tests alle Endpoints
- [x] `backend/pytest.ini` konfiguriert
- [ ] Frontend Component-Tests (Jest / React Testing Library)
- [ ] E2E-Tests (Cypress / Playwright)

---

## 🟣 PHASE 6: Analyse & Dokumentation

### Issue #27: Policy Impact Analysis Research
**Status**: ⬜ Ausstehend — wartet auf historische Daten  
**Priority**: Medium | **Labels**: data-science, research

---

### Issue #28: Model Performance Documentation
**Status**: ⬜ Ausstehend — wartet auf ML-Pipeline  
**Priority**: Medium | **Labels**: documentation, ml

---

### Issue #29: Studienprojekt Dokumentation
**Status**: ⬜ Ausstehend  
**Priority**: High | **Labels**: documentation, academic

---

### Issue #30: Präsentationsmaterialien
**Status**: ⬜ Ausstehend  
**Priority**: Medium | **Labels**: presentation

---

## 📌 Optionale Issues (#31–33)

| # | Thema | Status |
|---|-------|--------|
| 31 | Cloudflare Tunnel Deployment | ⬜ Optional |
| 32 | Push-Benachrichtigungssystem | ⬜ Optional |
| 33 | User Accounts & Authentication | ⬜ Optional |

---

## 🏷️ Legende

| Symbol | Bedeutung |
|--------|-----------|
| ✅ | Vollständig abgeschlossen |
| 🟡 | In Bearbeitung / teilweise fertig |
| ⬜ | Noch nicht begonnen |
| 🔴 | Blockiert |
