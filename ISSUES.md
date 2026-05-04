# 📋 Git Issues - Spritpreis Analytics Dashboard

Strukturierte Aufgabenliste für die Projektumsetzung.

---

## 🔴 PHASE 1: Dateninfrastruktur (Woche 1-2)

### Issue #1: API-Keys beantragen und Datenquellen Setup
**Priority**: High  
**Labels**: setup, data-sources  
**Assignee**: Developer

**Beschreibung:**
Beantragung der notwendigen API-Keys für die Datenquellen.

**Tasks:**
- [ ] Tankerkönig API-Key beantragen (https://creativecommons.tankerkoenig.de)
- [ ] EIA (Energy Information Administration) API-Key beantragen (https://www.eia.gov/opendata/)
- [ ] Zugang zu historischen Tankerkönig-Daten beantragen (Git-Repository)
- [ ] API-Keys in `.env` Datei eintragen
- [ ] API-Verbindungen testen

**Acceptance Criteria:**
- Alle API-Keys sind vorhanden und funktionieren
- Testabfragen erfolgreich durchgeführt

---

### Issue #2: PostgreSQL Datenbank-Schema Design
**Priority**: High  
**Labels**: database, architecture  
**Assignee**: Developer

**Beschreibung:**
Design und Implementierung des PostgreSQL Datenbank-Schemas für Spritpreise, Tankstellen, Rohölpreise und ML-Modell-Metadaten.

**Tasks:**
- [ ] ER-Diagramm erstellen
- [ ] SQLAlchemy Models erstellen:
  - [ ] `GasStation` (Tankstelleninformationen)
  - [ ] `FuelPrice` (Spritpreise mit Zeitstempel)
  - [ ] `CrudeOilPrice` (Rohölpreise)
  - [ ] `PoliticalEvent` (Politische Ereignisse)
  - [ ] `Prediction` (ML-Vorhersagen)
  - [ ] `ModelMetadata` (Trainierte Modelle)
- [ ] Alembic Migrationen erstellen
- [ ] Indizes für Performance optimieren
- [ ] Datenbank-Initialisierungs-Skript

**Acceptance Criteria:**
- Schema ist vollständig dokumentiert
- Migrationen laufen erfolgreich
- Performance-Tests bestanden

---

### Issue #3: Tankerkönig API Integration
**Priority**: High  
**Labels**: integration, data-fetcher  
**Assignee**: Developer

**Beschreibung:**
Integration der Tankerkönig API für Echtzeit- und historische Spritpreisdaten.

**Tasks:**
- [ ] `TankerkoenigService` Klasse erstellen
- [ ] Methoden implementieren:
  - [ ] `get_stations_by_radius()` - Umkreissuche
  - [ ] `get_prices()` - Preisabfrage für mehrere Tankstellen
  - [ ] `get_station_details()` - Detailabfrage
- [ ] Rate-Limiting implementieren (1 req/min)
- [ ] Error-Handling und Retry-Logik
- [ ] Caching-Mechanismus
- [ ] Unit-Tests schreiben

**Acceptance Criteria:**
- Alle API-Endpunkte funktionieren
- Rate-Limits werden eingehalten
- Tests mit >80% Coverage

---

### Issue #4: EIA API Integration für Rohölpreise
**Priority**: High  
**Labels**: integration, data-fetcher  
**Assignee**: Developer

**Beschreibung:**
Integration der U.S. Energy Information Administration API für Rohölpreisdaten (Brent, WTI).

**Tasks:**
- [ ] `EIAService` Klasse erstellen
- [ ] Methoden implementieren:
  - [ ] `get_brent_crude_prices()` - Brent Rohöl
  - [ ] `get_wti_crude_prices()` - WTI Rohöl
  - [ ] `get_historical_data()` - Historische Daten
- [ ] Daten-Transformation (USD/Barrel → EUR/Liter Umrechnung)
- [ ] Scheduled Jobs für täglichen Import
- [ ] Unit-Tests schreiben

**Acceptance Criteria:**
- Rohölpreisdaten werden erfolgreich abgerufen
- Daten werden korrekt in DB gespeichert
- Scheduled Jobs laufen stabil

---

### Issue #5: Daten-Import Pipeline für historische Daten
**Priority**: High  
**Labels**: data-pipeline, ETL  
**Assignee**: Developer

**Beschreibung:**
ETL-Pipeline für Import historischer Spritpreisdaten von Tankerkönig (CSV-Dateien seit 2014).

**Tasks:**
- [ ] CSV-Parser für Tankerkönig-Format implementieren
- [ ] Batch-Import-Funktion (große Datenmengen)
- [ ] Data-Cleaning und Validierung
- [ ] Duplikatserkennung
- [ ] Progress-Monitoring
- [ ] Import-Skript erstellen (`import_historical_data.py`)

**Acceptance Criteria:**
- Historische Daten (2014-heute) erfolgreich importiert
- Keine Duplikate in der DB
- Import-Zeit dokumentiert

---

### Issue #6: Explorative Datenanalyse (EDA)
**Priority**: Medium  
**Labels**: data-science, jupyter  
**Assignee**: Developer

**Beschreibung:**
Explorative Analyse der Spritpreisdaten in Jupyter Notebooks zur Feature-Discovery.

**Tasks:**
- [ ] Jupyter Notebook Setup
- [ ] Notebooks erstellen:
  - [ ] `01_data_exploration.ipynb` - Grundlegende Statistiken
  - [ ] `02_time_patterns.ipynb` - Zeitliche Muster (Uhrzeiten, Wochentage)
  - [ ] `03_regional_analysis.ipynb` - Regionale Unterschiede
  - [ ] `04_correlation_analysis.ipynb` - Korrelation Rohöl vs. Spritpreise
  - [ ] `05_policy_events.ipynb` - Policy Impact Analyse
- [ ] Visualisierungen erstellen
- [ ] Findings dokumentieren

**Acceptance Criteria:**
- Alle Notebooks laufen fehlerfrei
- Key Insights dokumentiert
- Visualisierungen exportiert

---

## 🟠 PHASE 2: Backend Development (Woche 3-5)

### Issue #7: FastAPI Routen-Architektur
**Priority**: High  
**Labels**: backend, api  
**Assignee**: Developer

**Beschreibung:**
Implementierung der REST API Endpunkte mit FastAPI.

**Tasks:**
- [ ] API-Router erstellen:
  - [ ] `prices.py` - Preisabfragen
  - [ ] `stations.py` - Tankstellensuche
  - [ ] `predictions.py` - Vorhersagen
  - [ ] `analytics.py` - Analysen
  - [ ] `oil_prices.py` - Rohölpreise
- [ ] Pydantic Schemas für Request/Response
- [ ] OpenAPI/Swagger Dokumentation
- [ ] API-Versionierung (v1)
- [ ] Error-Handling Middleware

**Acceptance Criteria:**
- Alle Endpunkte dokumentiert
- Swagger UI funktioniert
- Error-Handling einheitlich

---

### Issue #8: Prices API Endpoints
**Priority**: High  
**Labels**: backend, api, prices  
**Assignee**: Developer

**Beschreibung:**
REST API Endpunkte für Spritpreis-Abfragen.

**Endpoints:**
- `GET /api/v1/prices/current` - Aktuelle Preise
- `GET /api/v1/prices/history` - Historische Preise
- `GET /api/v1/prices/average` - Durchschnittspreise
- `GET /api/v1/prices/trends` - Preistrends

**Tasks:**
- [ ] Endpunkte implementieren
- [ ] Query-Parameter (fuel_type, region, date_range)
- [ ] Pagination implementieren
- [ ] Response-Caching
- [ ] Unit-Tests

**Acceptance Criteria:**
- Alle Endpunkte funktional
- Response-Zeiten <500ms
- Tests mit >80% Coverage

---

### Issue #9: Stations API Endpoints
**Priority**: High  
**Labels**: backend, api, stations  
**Assignee**: Developer

**Beschreibung:**
REST API Endpunkte für Tankstellensuche und -informationen.

**Endpoints:**
- `GET /api/v1/stations/nearby` - Tankstellen in der Nähe
- `GET /api/v1/stations/{station_id}` - Tankstellen-Details
- `GET /api/v1/stations/cheapest` - Günstigste Tankstellen
- `GET /api/v1/stations/compare` - Tankstellen-Vergleich

**Tasks:**
- [ ] Endpunkte implementieren
- [ ] Geo-Suche (Radius-Search)
- [ ] Sortierung und Filterung
- [ ] Unit-Tests

**Acceptance Criteria:**
- Geo-Suche funktioniert präzise
- Sortierung korrekt
- Tests vorhanden

---

### Issue #10: Scheduled Jobs Implementation
**Priority**: Medium  
**Labels**: backend, scheduler  
**Assignee**: Developer

**Beschreibung:**
Automatisierte Jobs für regelmäßigen Datenabruf und Modell-Retraining.

**Tasks:**
- [ ] APScheduler Setup
- [ ] Jobs implementieren:
  - [ ] `fetch_current_prices_job` - Stündlich
  - [ ] `fetch_oil_prices_job` - Täglich
  - [ ] `retrain_models_job` - Wöchentlich
  - [ ] `cleanup_old_data_job` - Monatlich
- [ ] Job-Monitoring und Logging
- [ ] Error-Notifications
- [ ] Job-Status-API

**Acceptance Criteria:**
- Alle Jobs laufen zuverlässig
- Logging vollständig
- Error-Handling robust

---

## 🟡 PHASE 3: ML Pipeline (Woche 6-8)

### Issue #11: Feature Engineering Pipeline
**Priority**: High  
**Labels**: ml, data-science  
**Assignee**: Developer

**Beschreibung:**
Feature Engineering für Predictive Analytics Modelle.

**Tasks:**
- [ ] `FeatureEngineer` Klasse erstellen
- [ ] Zeitbasierte Features:
  - [ ] Stunde, Wochentag, Monat, Feiertag
  - [ ] Zyklische Transformation (sin/cos)
- [ ] Lag Features:
  - [ ] Preise vor 1h, 6h, 24h, 7d, 30d
- [ ] Rolling Statistics:
  - [ ] Moving Average (7d, 30d)
  - [ ] Volatilität
  - [ ] Min/Max im Zeitfenster
- [ ] Externe Features:
  - [ ] Rohölpreis
  - [ ] USD/EUR Wechselkurs
  - [ ] Politische Events (Binary)
- [ ] Feature-Scaling (StandardScaler)
- [ ] Pipeline-Tests

**Acceptance Criteria:**
- Feature-Pipeline dokumentiert
- Reproduzierbare Features
- Tests vorhanden

---

### Issue #12: Prophet Forecasting Model
**Priority**: High  
**Labels**: ml, prophet, forecasting  
**Assignee**: Developer

**Beschreibung:**
Implementierung des Facebook Prophet Modells für Zeitreihen-Vorhersagen.

**Tasks:**
- [ ] `ProphetModel` Klasse erstellen
- [ ] Hyperparameter-Tuning:
  - [ ] `changepoint_prior_scale`
  - [ ] `seasonality_prior_scale`
  - [ ] Custom Seasonalities
- [ ] Feiertage-Integration
- [ ] Model-Training Pipeline
- [ ] Prediction-Funktion
- [ ] Konfidenzintervalle
- [ ] Model-Evaluation (RMSE, MAE, MAPE)
- [ ] Model-Persistierung (Pickle)

**Acceptance Criteria:**
- Modell trainiert erfolgreich
- MAPE <10% auf Test-Set
- Vorhersagen plausibel

---

### Issue #13: LSTM Deep Learning Model
**Priority**: Medium  
**Labels**: ml, tensorflow, deep-learning  
**Assignee**: Developer

**Beschreibung:**
LSTM Modell für komplexe Zeitreihenvorhersagen mit TensorFlow/Keras.

**Tasks:**
- [ ] `LSTMModel` Klasse erstellen
- [ ] Sequence-Preparation (Lookback-Window)
- [ ] LSTM-Architektur:
  - [ ] Input Layer
  - [ ] 2-3 LSTM Layers
  - [ ] Dropout Regularization
  - [ ] Dense Output Layer
- [ ] Training mit Callbacks:
  - [ ] EarlyStopping
  - [ ] ModelCheckpoint
  - [ ] ReduceLROnPlateau
- [ ] Multi-Step Forecasting
- [ ] Model-Evaluation
- [ ] Model-Speicherung (SavedModel)

**Acceptance Criteria:**
- LSTM-Modell konvergiert
- Performance besser als Baseline
- Inference-Zeit <100ms

---

### Issue #14: ARIMA/SARIMAX Statistical Model
**Priority**: Medium  
**Labels**: ml, statistics, time-series  
**Assignee**: Developer

**Beschreibung:**
Klassische statistische Zeitreihenmodelle mit statsmodels.

**Tasks:**
- [ ] `ARIMAModel` Klasse erstellen
- [ ] Stationaritäts-Tests (ADF, KPSS)
- [ ] ACF/PACF Analyse
- [ ] Parameter-Optimierung (p, d, q)
- [ ] SARIMAX mit exogenen Variablen
- [ ] Residuen-Analyse
- [ ] Forecasting-Funktion
- [ ] Model-Comparison

**Acceptance Criteria:**
- Modell statistisch valide
- Residuen sind White Noise
- Dokumentation vollständig

---

### Issue #15: Model Evaluation & Comparison Framework
**Priority**: Medium  
**Labels**: ml, evaluation  
**Assignee**: Developer

**Beschreibung:**
Framework zum Vergleich und Evaluation verschiedener ML-Modelle.

**Tasks:**
- [ ] `ModelEvaluator` Klasse erstellen
- [ ] Metriken implementieren:
  - [ ] RMSE (Root Mean Squared Error)
  - [ ] MAE (Mean Absolute Error)
  - [ ] MAPE (Mean Absolute Percentage Error)
  - [ ] R² Score
- [ ] Cross-Validation
- [ ] Backtesting auf historischen Daten
- [ ] Visualisierung (Actual vs. Predicted)
- [ ] Model-Comparison-Report
- [ ] Best-Model-Selection

**Acceptance Criteria:**
- Alle Metriken berechnet
- Vergleichs-Report generiert
- Best Model ausgewählt

---

### Issue #16: Prediction Service Integration
**Priority**: High  
**Labels**: ml, backend, api  
**Assignee**: Developer

**Beschreibung:**
Integration der ML-Modelle in die FastAPI Backend-Services.

**Tasks:**
- [ ] `PredictionService` Klasse erstellen
- [ ] Model-Loading (Prophet, LSTM, ARIMA)
- [ ] Prediction-API Endpoints:
  - [ ] `POST /api/v1/predictions/short-term` (24-72h)
  - [ ] `POST /api/v1/predictions/medium-term` (1-4 Wochen)
  - [ ] `GET /api/v1/predictions/best-time` (Beste Tankzeit)
- [ ] Ensemble-Predictions (Weighted Average)
- [ ] Caching von Predictions
- [ ] Async-Processing für lange Berechnungen

**Acceptance Criteria:**
- Predictions via API abrufbar
- Response-Zeiten akzeptabel
- Caching funktioniert

---

## 🔵 PHASE 4: Frontend Development (Woche 9-11)

### Issue #17: React Project Setup & Architecture
**Priority**: High  
**Labels**: frontend, react, setup  
**Assignee**: Developer

**Beschreibung:**
Initialisierung des React Frontend-Projekts mit modernem Setup.

**Tasks:**
- [ ] Vite oder Create-React-App Setup
- [ ] Project-Struktur erstellen
- [ ] Dependencies installieren:
  - [ ] React Router
  - [ ] Axios
  - [ ] D3.js
  - [ ] Tailwind CSS / Material-UI
  - [ ] date-fns
- [ ] ESLint & Prettier Setup
- [ ] Environment Variables (.env)
- [ ] API-Service-Layer
- [ ] Routing-Struktur

**Acceptance Criteria:**
- Projekt läuft lokal
- Development-Server funktioniert
- Build erfolgreich

---

### Issue #18: Dashboard Main Component
**Priority**: High  
**Labels**: frontend, dashboard  
**Assignee**: Developer

**Beschreibung:**
Haupt-Dashboard-Komponente mit Overview und Navigation.

**Tasks:**
- [ ] `Dashboard.jsx` erstellen
- [ ] Layout (Header, Sidebar, Main Content)
- [ ] Aktuelle Durchschnittspreise anzeigen
- [ ] Tages-Trend Indikator (↑↓)
- [ ] Quick-Stats Cards
- [ ] Navigation zu Sub-Pages
- [ ] Responsive Design

**Acceptance Criteria:**
- Dashboard zeigt Live-Daten
- Layout responsive
- Navigation funktioniert

---

### Issue #19: D3.js Price Chart Components
**Priority**: High  
**Labels**: frontend, d3js, visualization  
**Assignee**: Developer

**Beschreibung:**
Interaktive Preis-Charts mit D3.js.

**Components:**
- [ ] `PriceLineChart.jsx` - Zeitreihen Liniendiagramm
- [ ] `PredictionChart.jsx` - Vorhersagen mit Konfidenzintervallen
- [ ] `ComparisonChart.jsx` - Multi-Series Vergleich

**Features:**
- [ ] Zoom & Pan
- [ ] Tooltip on Hover
- [ ] Zeitraum-Auswahl (1D, 1W, 1M, 1Y, All)
- [ ] Fuel-Type Toggle (E5, E10, Diesel)
- [ ] Export als PNG

**Acceptance Criteria:**
- Charts laden schnell (<1s)
- Interaktionen flüssig
- Responsive auf Mobile

---

### Issue #20: Heatmap für Uhrzeitanalyse
**Priority**: Medium  
**Labels**: frontend, d3js, visualization  
**Assignee**: Developer

**Beschreibung:**
Heatmap zur Visualisierung der Preise nach Uhrzeit und Wochentag.

**Tasks:**
- [ ] `TimeHeatmap.jsx` erstellen
- [ ] D3.js Heatmap implementieren
- [ ] X-Axis: Stunden (0-23)
- [ ] Y-Axis: Wochentage
- [ ] Farbskala (grün=günstig, rot=teuer)
- [ ] Tooltip mit exakten Werten
- [ ] Best-Time Highlight

**Acceptance Criteria:**
- Heatmap klar lesbar
- Farbskala intuitiv
- Performance gut

---

### Issue #21: Interactive Map Component
**Priority**: Medium  
**Labels**: frontend, maps  
**Assignee**: Developer

**Beschreibung:**
Interaktive Karte mit Tankstellen und Preisen.

**Tasks:**
- [ ] `StationMap.jsx` erstellen
- [ ] Kartenbibliothek auswählen (Leaflet / Mapbox)
- [ ] Tankstellen als Marker
- [ ] Marker-Color nach Preis
- [ ] Popup mit Station-Details
- [ ] Filter (Fuel-Type, Price-Range)
- [ ] Geo-Location des Users
- [ ] Radius-Search

**Acceptance Criteria:**
- Karte zeigt alle Stationen
- Performance mit 1000+ Marker
- Geo-Location funktioniert

---

### Issue #22: Policy Impact Timeline
**Priority**: Low  
**Labels**: frontend, visualization  
**Assignee**: Developer

**Beschreibung:**
Timeline-Komponente für politische Ereignisse und deren Auswirkungen.

**Tasks:**
- [ ] `PolicyTimeline.jsx` erstellen
- [ ] Ereignisse als Timeline
- [ ] Ereignis-Details (Name, Datum, Beschreibung)
- [ ] Preis-Overlay (Vorher/Nachher)
- [ ] Statistical Significance Indicator
- [ ] Zoom auf Ereignis

**Acceptance Criteria:**
- Timeline übersichtlich
- Ereignisse vollständig
- Preis-Korrelation sichtbar

---

### Issue #23: API Service Layer (Frontend)
**Priority**: High  
**Labels**: frontend, api  
**Assignee**: Developer

**Beschreibung:**
Zentraler API-Service für Frontend-Backend-Kommunikation.

**Tasks:**
- [ ] `api.js` erstellen
- [ ] Axios-Instanz konfigurieren
- [ ] API-Methoden:
  - [ ] `fetchCurrentPrices()`
  - [ ] `fetchPriceHistory()`
  - [ ] `fetchNearbyStations()`
  - [ ] `fetchPredictions()`
  - [ ] `fetchAnalytics()`
- [ ] Error-Handling
- [ ] Loading States
- [ ] Request Cancellation
- [ ] Retry-Logic

**Acceptance Criteria:**
- Alle API-Calls funktionieren
- Error-Handling robust
- TypeScript-Types (optional)

---

## 🟢 PHASE 5: Integration & Testing (Woche 12)

### Issue #24: End-to-End Integration
**Priority**: High  
**Labels**: integration, testing  
**Assignee**: Developer

**Beschreibung:**
Vollständige Integration aller Komponenten und E2E-Tests.

**Tasks:**
- [ ] Frontend-Backend Integration testen
- [ ] API-Endpoints End-to-End testen
- [ ] ML-Predictions integrieren
- [ ] Database Queries optimieren
- [ ] Error-Handling durchgängig
- [ ] Performance-Tests
- [ ] Load-Tests

**Acceptance Criteria:**
- Alle Features funktionieren zusammen
- Keine kritischen Bugs
- Performance-Ziele erreicht

---

### Issue #25: Docker Setup & Containerization
**Priority**: High  
**Labels**: docker, devops  
**Assignee**: Developer

**Beschreibung:**
Docker-Setup für lokale Entwicklung und Deployment.

**Tasks:**
- [ ] Dockerfile für Backend erstellen
- [ ] Dockerfile für Frontend erstellen
- [ ] docker-compose.yml:
  - [ ] Backend Service
  - [ ] Frontend Service
  - [ ] PostgreSQL Service
  - [ ] pgAdmin (optional)
- [ ] Environment Variables
- [ ] Volume Mapping (Data Persistence)
- [ ] Networking
- [ ] Health Checks
- [ ] README für Docker-Setup

**Acceptance Criteria:**
- `docker-compose up` startet alles
- Services kommunizieren
- Data Persistence funktioniert

---

### Issue #26: Testing & Test Coverage
**Priority**: Medium  
**Labels**: testing, quality  
**Assignee**: Developer

**Beschreibung:**
Umfassende Tests für Backend und Frontend.

**Backend:**
- [ ] Unit-Tests (pytest)
- [ ] Integration-Tests
- [ ] API-Tests
- [ ] ML-Model-Tests

**Frontend:**
- [ ] Component-Tests (Jest, React Testing Library)
- [ ] Integration-Tests
- [ ] E2E-Tests (optional: Cypress/Playwright)

**Target:**
- Backend: >80% Coverage
- Frontend: >70% Coverage

**Acceptance Criteria:**
- Coverage-Ziele erreicht
- CI Pipeline (optional)
- Tests dokumentiert

---

## 🟣 PHASE 6: Analyse & Dokumentation (Woche 13-14)

### Issue #27: Policy Impact Analysis Research
**Priority**: Medium  
**Labels**: data-science, research  
**Assignee**: Developer

**Beschreibung:**
Wissenschaftliche Analyse der Auswirkungen politischer Eingriffe auf Spritpreise.

**Events to Analyze:**
- [ ] CO2-Steuer Einführung (2021)
- [ ] Mehrwertsteuersenkung (2020)
- [ ] Tankrabatt (Juni-Aug 2022)
- [ ] Ukraine-Krieg (Feb 2022)

**Tasks:**
- [ ] Jupyter Notebook erstellen
- [ ] Statistical Tests:
  - [ ] T-Tests (Vorher/Nachher)
  - [ ] ANOVA
  - [ ] Interrupted Time Series Analysis
- [ ] Effektgrößen berechnen
- [ ] Visualisierungen
- [ ] Findings dokumentieren

**Acceptance Criteria:**
- Alle Events analysiert
- Statistical Significance berechnet
- Report erstellt

---

### Issue #28: Model Performance Documentation
**Priority**: Medium  
**Labels**: documentation, ml  
**Assignee**: Developer

**Beschreibung:**
Dokumentation der ML-Modelle und deren Performance.

**Tasks:**
- [ ] Model-Comparison-Report
- [ ] Hyperparameter-Dokumentation
- [ ] Performance-Metriken
- [ ] Confusion Matrix (falls relevant)
- [ ] Feature-Importance-Analyse
- [ ] Training-Time und Inference-Time
- [ ] Model-Selection-Rationale

**Acceptance Criteria:**
- Alle Modelle dokumentiert
- Vergleich transparent
- Reproduzierbar

---

### Issue #29: Studienprojekt Dokumentation
**Priority**: High  
**Labels**: documentation, academic  
**Assignee**: Developer

**Beschreibung:**
Vollständige Dokumentation für das Studienprojekt (Hochschule Aalen).

**Sections:**
- [ ] 1. Einleitung & Motivation
- [ ] 2. Datenquellen & Datenbeschaffung
- [ ] 3. Datenbank-Design
- [ ] 4. Explorative Datenanalyse
- [ ] 5. Feature Engineering
- [ ] 6. Predictive Analytics Methoden
- [ ] 7. Model-Training & Evaluation
- [ ] 8. Backend-Architektur
- [ ] 9. Frontend-Implementation
- [ ] 10. Policy Impact Analysis
- [ ] 11. Ergebnisse & Erkenntnisse
- [ ] 12. Fazit & Ausblick

**Format:** PDF (LaTeX oder Markdown → PDF)

**Acceptance Criteria:**
- Dokumentation vollständig
- Wissenschaftlich fundiert
- Grafiken und Tabellen eingebunden

---

### Issue #30: Präsentationsmaterialien erstellen
**Priority**: Medium  
**Labels**: presentation  
**Assignee**: Developer

**Beschreibung:**
Präsentations-Slides für Projektvorstellung.

**Tasks:**
- [ ] PowerPoint/Keynote/Reveal.js Präsentation
- [ ] Slides:
  - [ ] Problemstellung
  - [ ] Datenquellen
  - [ ] Technologie-Stack
  - [ ] Architektur
  - [ ] ML-Methoden
  - [ ] Dashboard-Demo (Screenshots)
  - [ ] Key Findings
  - [ ] Live-Demo (optional)
  - [ ] Q&A
- [ ] Sprechnotizen
- [ ] Demo-Video (optional)

**Acceptance Criteria:**
- Präsentation vollständig
- Zeitrahmen: 15-20 Min
- Visuell ansprechend

---

## 📌 Zusätzliche Issues (Optional)

### Issue #31: Cloudflare Tunnel Deployment
**Priority**: Low  
**Labels**: deployment, infrastructure  
**Assignee**: Developer

**Beschreibung:**
Deployment mit Cloudflare Tunnel für externe Erreichbarkeit.

**Tasks:**
- [ ] Cloudflare Account Setup
- [ ] Tunnel erstellen
- [ ] Domain konfigurieren
- [ ] SSL/TLS Setup
- [ ] Backend via Tunnel
- [ ] Frontend via Tunnel
- [ ] Monitoring

---

### Issue #32: Benachrichtigungssystem
**Priority**: Low  
**Labels**: feature, notifications  
**Assignee**: Developer

**Beschreibung:**
Push-Benachrichtigungen wenn Preise unter Schwellwert fallen.

**Tasks:**
- [ ] User Preferences (Schwellwerte)
- [ ] Push-Notification Service
- [ ] Email-Benachrichtigungen
- [ ] Frontend-Integration

---

### Issue #33: User Accounts & Authentication
**Priority**: Low  
**Labels**: feature, auth  
**Assignee**: Developer

**Beschreibung:**
User-Accounts für personalisierte Features.

**Tasks:**
- [ ] JWT Authentication
- [ ] User Registration/Login
- [ ] Favoriten-Tankstellen
- [ ] Preis-Alerts
- [ ] Preference Storage

---

## 📊 Issue Status Tracking

**Total Issues:** 33  
**Phase 1:** 6 Issues  
**Phase 2:** 4 Issues  
**Phase 3:** 6 Issues  
**Phase 4:** 7 Issues  
**Phase 5:** 3 Issues  
**Phase 6:** 4 Issues  
**Optional:** 3 Issues

---

## 🏷️ Label Definitions

- `setup` - Initial setup tasks
- `data-sources` - Data acquisition
- `database` - Database-related
- `architecture` - System design
- `integration` - Third-party integrations
- `data-fetcher` - Data fetching services
- `data-pipeline` - ETL pipelines
- `data-science` - Data science tasks
- `jupyter` - Jupyter notebooks
- `backend` - Backend development
- `api` - API development
- `scheduler` - Scheduled jobs
- `ml` - Machine learning
- `prophet` - Prophet model
- `tensorflow` - TensorFlow/Keras
- `deep-learning` - Deep learning
- `statistics` - Statistical models
- `time-series` - Time series analysis
- `evaluation` - Model evaluation
- `frontend` - Frontend development
- `react` - React-specific
- `d3js` - D3.js visualizations
- `visualization` - Data visualization
- `maps` - Map components
- `testing` - Testing tasks
- `quality` - Quality assurance
- `docker` - Docker/containerization
- `devops` - DevOps tasks
- `documentation` - Documentation
- `academic` - Academic documentation
- `presentation` - Presentation materials
- `deployment` - Deployment tasks
- `infrastructure` - Infrastructure
- `feature` - New features
- `notifications` - Notifications
- `auth` - Authentication/Authorization

---

**Letzte Aktualisierung:** Mai 2026
