# ========================================
# REQUIREMENTS OVERVIEW
# ========================================
# Diese Datei listet ALLE Pakete auf, die du bereits hast
# und zeigt, welche für das Spritpreis-Projekt verwendet werden.

# ========================================
# ✅ BEREITS VORHANDEN & WIRD VERWENDET
# ========================================

# Data Processing
numpy          # ✅ Verwendet für numerische Berechnungen
pandas         # ✅ Verwendet für Datenverarbeitung
matplotlib     # ✅ Verwendet für Visualisierungen (EDA)
seaborn        # ✅ Verwendet für statistische Plots
scikit-learn   # ✅ Verwendet für ML-Modelle
tensorflow     # ✅ Verwendet für LSTM Deep Learning

# Notebooks (für Explorative Datenanalyse)
jupyter        # ✅ Verwendet für Data Science Notebooks
notebook       # ✅ Verwendet
ipykernel      # ✅ Verwendet

# Visualization
plotly         # ✅ Verwendet für interaktive Plots

# ========================================
# ⚠️ BEREITS VORHANDEN & NICHT VERWENDET
# ========================================

streamlit      # ❌ NICHT verwendet (wir nutzen FastAPI + React)
pygame         # ❌ NICHT verwendet (nicht relevant)
pyopengl       # ❌ NICHT verwendet (nicht relevant)
pillow         # ❌ NICHT verwendet (keine Bildverarbeitung)
opencv-python  # ❌ NICHT verwendet (keine Computer Vision)

# ========================================
# 🆕 ZUSÄTZLICH BENÖTIGT FÜR DAS PROJEKT
# ========================================

# Web Framework & API
fastapi                 # 🆕 REST API Backend
uvicorn[standard]       # 🆕 ASGI Server
python-multipart        # 🆕 File uploads support

# Datenbank
sqlalchemy             # 🆕 ORM für PostgreSQL
psycopg2-binary        # 🆕 PostgreSQL Adapter
alembic                # 🆕 Database Migrations

# API Clients
requests               # 🆕 HTTP Client (Tankerkönig, EIA API)
httpx                  # 🆕 Async HTTP Client

# Validierung & Config
pydantic               # 🆕 Data Validation
pydantic-settings      # 🆕 Settings Management
python-dotenv          # 🆕 Environment Variables

# Zeitreihen-Forecasting (WICHTIG!)
prophet                # 🆕 Facebook Prophet (Zeitreihen)
statsmodels            # 🆕 ARIMA/SARIMAX (Statistik)

# Task Scheduling
apscheduler            # 🆕 Scheduled Jobs (tägl. Daten-Updates)

# Zeit-Utilities
python-dateutil        # 🆕 Datum/Zeit Parsing
pytz                   # 🆕 Timezones

# Logging
loguru                 # 🆕 Besseres Logging

# Testing
pytest                 # 🆕 Testing Framework
pytest-asyncio         # 🆕 Async Testing
pytest-cov             # 🆕 Code Coverage

# Code Quality
black                  # 🆕 Code Formatter
flake8                 # 🆕 Linter
mypy                   # 🆕 Type Checker

# ========================================
# 📥 INSTALLATIONS-ANLEITUNG
# ========================================

# Option 1: Alle Requirements installieren (empfohlen)
pip install -r backend/requirements.txt

# Option 2: Nur neue Pakete installieren
pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic
pip install requests httpx pydantic python-dotenv
pip install prophet statsmodels apscheduler
pip install python-dateutil pytz loguru
pip install pytest pytest-asyncio black flake8

# Option 3: Projekt-spezifische Installation
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# ========================================
# 💾 PAKETGRÖSZEN (ungefähr)
# ========================================
# Gesamtgröße der neuen Pakete: ~2-3 GB
# - TensorFlow allein: ~500 MB
# - Prophet + Dependencies: ~200 MB
# - SQLAlchemy + PostgreSQL: ~50 MB
# - FastAPI + Uvicorn: ~30 MB
# - Rest: ~100 MB
