# 🚗⛽ Spritpreis Analytics Dashboard

Ein transparentes, minimalistisches Dashboard zur Analyse und Vorhersage von Spritpreisen in Deutschland und Europa mit Predictive Analytics.

## 🎯 Projektvision

Diese Anwendung ermöglicht:
- **Echtzeit-Preisanalyse** von über 14.000+ Tankstellen
- **Predictive Analytics** für zukünftige Preisentwicklungen
- **Zeitanalyse**: Wann ist tanken am günstigsten?
- **Policy Impact Analysis**: Wie wirken sich politische Eingriffe aus?
- **Rohölpreis-Korrelation**: Zusammenhang zwischen Rohöl und Tankstellenpreisen

## 🏗️ Technologie-Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Datenbank**: PostgreSQL
- **ORM**: SQLAlchemy
- **Validierung**: Pydantic

### Frontend
- **Framework**: React
- **Visualisierung**: D3.js
- **Styling**: Tailwind CSS / Material-UI

### Predictive Analytics
- **Zeitreihen**: Prophet (Facebook)
- **Statistik**: statsmodels (ARIMA/SARIMAX)
- **Deep Learning**: TensorFlow/Keras (LSTM)
- **ML**: scikit-learn
- **Datenverarbeitung**: pandas, numpy

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Deployment**: Cloudflare Tunnel (geplant)

## 📊 Datenquellen

### Spritpreise
- **Tankerkönig API** (Deutschland)
  - Echtzeit-Preise
  - Historische Daten seit Juni 2014
  - Lizenz: CC BY 4.0

### Rohölpreise
- **U.S. Energy Information Administration (EIA) API**
  - Brent Crude Oil
  - WTI Crude Oil
  - Historische und aktuelle Daten

### Zukünftig (Europa-Erweiterung)
- Weitere nationale APIs für europäische Länder

## 📁 Projektstruktur

```
spritpreis-analytics/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── api/            # API Routes
│   │   ├── models/         # SQLAlchemy Models
│   │   ├── schemas/        # Pydantic Schemas
│   │   ├── services/       # Business Logic
│   │   └── ml/             # Machine Learning Models
│   └── requirements.txt
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/    # React Components
│   │   └── services/      # API Communication
│   └── package.json
├── data/                  # Data Storage
│   ├── raw/              # Raw API Data
│   ├── processed/        # Processed Data
│   └── models/           # Trained ML Models
├── notebooks/            # Jupyter Notebooks
└── docs/                 # Documentation
```

## 🚀 Entwicklungsplan

### Phase 1: Dateninfrastruktur (Woche 1-2)
- [ ] API-Keys beantragen (Tankerkönig, EIA)
- [ ] Datenbank-Schema designen
- [ ] Daten-Import-Pipeline
- [ ] Explorative Datenanalyse

### Phase 2: Backend Development (Woche 3-5)
- [ ] FastAPI Setup
- [ ] REST API Endpoints
- [ ] Daten-Fetcher Services
- [ ] Scheduled Jobs

### Phase 3: ML Pipeline (Woche 6-8)
- [ ] Feature Engineering
- [ ] Prophet Modell
- [ ] LSTM Modell
- [ ] Model Evaluation

### Phase 4: Frontend Development (Woche 9-11)
- [ ] React Setup
- [ ] Dashboard Components
- [ ] D3.js Visualisierungen
- [ ] Responsive Design

### Phase 5: Integration & Testing (Woche 12)
- [ ] End-to-End Integration
- [ ] Testing
- [ ] Docker Setup
- [ ] Dokumentation

### Phase 6: Analyse & Dokumentation (Woche 13-14)
- [ ] Policy Impact Analysen
- [ ] Wissenschaftliche Auswertung
- [ ] Präsentationsmaterialien

## 🛠️ Setup & Installation

### Voraussetzungen
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

### Datenbank Setup
```bash
# PostgreSQL Datenbank erstellen
createdb spritpreis_analytics
```

### Umgebungsvariablen
Erstelle `.env` Dateien basierend auf `.env.example`

## 📈 Features

### Dashboard
- Aktuelle Durchschnittspreise (E5, E10, Diesel)
- Preisentwicklung (interaktive Zeitreihen)
- Top günstigste Tankstellen in der Nähe
- Empfehlungen: "Jetzt tanken" oder "Besser warten bis..."

### Predictive Analytics
- Kurzfrist-Prognose (24-72 Stunden)
- Mittelfrist-Prognose (1-4 Wochen)
- Konfidenzintervalle
- Beste Zeit zum Tanken

### Uhrzeitanalyse
- Heatmap: Preise nach Uhrzeit/Wochentag
- Statistik: Günstigste vs. teuerste Stunden
- Wochenend- vs. Wochentagsmuster

### Regionale Analyse
- Karte mit Preisen nach Bundesländern
- Stadt vs. Autobahn Vergleich
- Markenvergleich

### Policy Impact Analysis
- Timeline politischer Ereignisse
- Vorher/Nachher-Analysen
- Statistische Signifikanz

## 📚 API Dokumentation

Nach dem Start des Backends ist die API-Dokumentation verfügbar unter:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🧪 Testing

```bash
# Backend Tests
cd backend
pytest

# Frontend Tests
cd frontend
npm test
```

## 📝 Lizenz

Dieses Projekt ist ein Studienprojekt für die Hochschule Aalen.

**Datenquellen-Lizenzen:**
- Tankerkönig API: CC BY 4.0 (Namensnennung erforderlich)
- Historische Spritpreisdaten: BY-NC-SA-4.0 (nicht-kommerziell)
- EIA API: Public Domain (U.S. Government Data)

## 👥 Autoren

Studienprojekt - Predictive Analytics
Hochschule Aalen, Semester 1

## 🙏 Danksagungen

- Tankerkönig.de für die freie API und historische Daten
- U.S. Energy Information Administration für Rohölpreisdaten
- Bundeskartellamt MTS-K für Spritpreisdaten

---

**Status**: 🚧 In Entwicklung

Letztes Update: Mai 2026
