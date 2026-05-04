# 🚀 Docker Development Environment Setup

## Voraussetzungen

1. Docker installiert ✅
2. Docker Daemon gestartet
3. User hat Docker-Rechte

---

## 🔧 Docker Daemon starten

```bash
# Docker Daemon starten
sudo systemctl start docker

# Status überprüfen
sudo systemctl status docker

# Docker beim Systemstart aktivieren (optional)
sudo systemctl enable docker
```

---

## 👤 User zu Docker-Gruppe hinzufügen (ohne sudo)

```bash
# User zur docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Gruppe aktivieren (oder neu einloggen)
newgrp docker

# Testen ob es funktioniert (ohne sudo!)
docker ps
```

---

## 🚀 Development Environment starten

### Option 1: Alles auf einmal starten (empfohlen)

```bash
# Alle Services starten (DB + Backend + Frontend)
docker compose up -d

# Logs ansehen
docker compose logs -f

# Status prüfen
docker compose ps
```

### Option 2: Services einzeln starten

```bash
# 1. Nur Datenbank starten
docker compose up -d db

# 2. Backend starten (baut Image beim ersten Mal)
docker compose up -d backend

# 3. Frontend starten
docker compose up -d frontend

# 4. Optional: pgAdmin starten
docker compose --profile dev up -d pgadmin
```

---

## 📊 URLs nach dem Start

| Service | URL | Beschreibung |
|---------|-----|--------------|
| **Backend API** | http://localhost:8000 | FastAPI Backend |
| **API Docs (Swagger)** | http://localhost:8000/docs | Interactive API Documentation |
| **Frontend** | http://localhost:3000 | React Dashboard |
| **PostgreSQL** | localhost:5432 | Database (intern) |
| **pgAdmin** | http://localhost:5050 | Database Management UI |

---

## 🔍 Nützliche Docker Befehle

### Container Management

```bash
# Alle Container anzeigen
docker compose ps

# Logs ansehen (alle Services)
docker compose logs -f

# Logs eines einzelnen Services
docker compose logs -f backend
docker compose logs -f db

# Container stoppen
docker compose stop

# Container stoppen und entfernen
docker compose down

# Container + Volumes entfernen (ACHTUNG: Daten gehen verloren!)
docker compose down -v

# Container neu bauen
docker compose build
docker compose up -d --build
```

### Container betreten

```bash
# In Backend-Container (Python Shell)
docker compose exec backend bash
# Dann: python
# >>> from app.database import engine
# >>> ...

# In DB-Container (PostgreSQL Shell)
docker compose exec db psql -U spritpreis -d spritpreis_analytics

# In Frontend-Container
docker compose exec frontend sh
```

### Database Management

```bash
# PostgreSQL Backup erstellen
docker compose exec db pg_dump -U spritpreis spritpreis_analytics > backup.sql

# Backup wiederherstellen
docker compose exec -T db psql -U spritpreis spritpreis_analytics < backup.sql

# Datenbank-Tabellen anzeigen
docker compose exec db psql -U spritpreis -d spritpreis_analytics -c "\dt"
```

---

## 🗄️ pgAdmin Setup (optional)

Wenn du pgAdmin verwenden möchtest:

```bash
# pgAdmin starten
docker compose --profile dev up -d pgadmin

# URL öffnen: http://localhost:5050
# Login: admin@spritpreis.local / admin

# Server in pgAdmin hinzufügen:
# Host: db
# Port: 5432
# Database: spritpreis_analytics
# Username: spritpreis
# Password: spritpreis123
```

---

## 🐛 Troubleshooting

### Backend startet nicht

```bash
# Logs ansehen
docker compose logs backend

# Häufige Probleme:
# 1. Datenbank nicht erreichbar -> Warten auf DB health check
# 2. Port 8000 bereits belegt -> Anderen Port in docker-compose.yml
# 3. Fehler in Python Code -> Logs prüfen
```

### Frontend startet nicht

```bash
# Logs ansehen
docker compose logs frontend

# Häufige Probleme:
# 1. npm install schlägt fehl -> Container neu bauen
# 2. Port 3000 belegt -> Anderen Port verwenden
```

### Datenbank-Verbindungsprobleme

```bash
# DB-Container läuft?
docker compose ps db

# DB-Logs prüfen
docker compose logs db

# Verbindung testen
docker compose exec db psql -U spritpreis -d spritpreis_analytics -c "SELECT 1;"
```

### Docker Daemon läuft nicht

```bash
# Status prüfen
sudo systemctl status docker

# Starten
sudo systemctl start docker

# Fehler-Logs
sudo journalctl -u docker -n 50
```

---

## 🔄 Development Workflow

### 1. Entwicklung starten

```bash
docker compose up -d
```

### 2. Code ändern

- Backend-Code in `backend/` wird automatisch neu geladen (Hot Reload)
- Frontend-Code in `frontend/src/` wird automatisch neu geladen
- Änderungen sind sofort sichtbar!

### 3. Datenbank-Migrationen

```bash
# Migration erstellen
docker compose exec backend alembic revision --autogenerate -m "Add new table"

# Migration anwenden
docker compose exec backend alembic upgrade head

# Migration rückgängig machen
docker compose exec backend alembic downgrade -1
```

### 4. Tests ausführen

```bash
# Backend-Tests
docker compose exec backend pytest

# Mit Coverage
docker compose exec backend pytest --cov=app --cov-report=html
```

### 5. Code-Formatierung

```bash
# Black (Python formatter)
docker compose exec backend black app/

# Flake8 (Linter)
docker compose exec backend flake8 app/
```

### 6. Beenden

```bash
# Container stoppen (Daten bleiben erhalten)
docker compose stop

# Container stoppen und entfernen (Daten bleiben erhalten)
docker compose down
```

---

## 📦 Volumes & Persistence

### Was wird persistent gespeichert?

- **postgres_data** Volume: Alle Datenbank-Daten
- **./backend**: Dein Backend-Code (bind mount)
- **./frontend**: Dein Frontend-Code (bind mount)
- **./data**: Daten-Ordner (bind mount)

### Alles löschen und neu starten

```bash
# WARNUNG: Löscht alle Daten!
docker compose down -v
docker compose up -d --build
```

---

## ✅ Erste Schritte nach dem Start

1. **Backend API testen:**
   ```bash
   curl http://localhost:8000
   curl http://localhost:8000/health
   ```

2. **API Dokumentation öffnen:**
   - Browser: http://localhost:8000/docs

3. **Frontend öffnen:**
   - Browser: http://localhost:3000

4. **Datenbank initialisieren:**
   ```bash
   # Migrationen anwenden
   docker compose exec backend alembic upgrade head
   ```

---

## 🎯 Nächste Schritte

1. ✅ Docker Umgebung läuft
2. 🔜 API-Keys in `.env` eintragen (Tankerkönig, EIA)
3. 🔜 Datenbank-Migrationen anwenden
4. 🔜 Erste Daten importieren
5. 🔜 Backend API-Endpoints testen
6. 🔜 Frontend entwickeln

---

**Status:** Development Environment ist bereit! 🚀
