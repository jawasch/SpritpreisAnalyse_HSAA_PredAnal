# Spritpreisanalyse mit Multi-Layer Perceptron

Studienprojekt — HS Aalen, Modul Predictive Analytics, Semester 1

## Projektziel

Ein Speditionsunternehmen betreibt 25 LKWs auf fünf Festrouten (je ~100 km ab Aalen). Das Modell sagt vorher, **welche der fünf Stationen in den nächsten 72 Stunden am günstigsten für Diesel ist** — damit der Disponent die Rückkehrtankstopps kostenoptimiert planen kann.

Geschätztes Einsparpotenzial: **ca. 19.300 €/Jahr** gegenüber zufälliger Stationswahl (bei Ø 7,93 ct/L Preisunterschied zwischen den Stationen und 3.750 L Tagesverbrauch der Flotte).

## Ergebnisse (Testdatensatz Jan 2024 – Mai 2026)

| Metrik | Baseline (Dummy) | MLP `(32,)` |
|---|---|---|
| MAE | 0,454 €/L | **0,026 €/L** |
| RMSE | 0,485 €/L | **0,036 €/L** |
| R² | — | **0,955** |
| Skill Score | — | **94,3 %** |
| Pick Accuracy (günstigste Station) | 20 % (Zufall) | **46,0 %** |
| Ø Spearman ρ (Stationsranking) | — | **0,496** |

## Methodik (CRISP-DM)

### Daten

- **Quelle:** Tankerkönig Open Data — ~87 GB historische CSV-Dateien
- **Umfang:** 1,1 Mrd. Preiseinträge, 2014–2026, 15.000+ Tankstellen
- **Stationsauswahl:** 5 Stationen per Haversine-Distanz und Datenverfügbarkeit aus einem 80–120-km-Ring um Aalen (je eine pro Himmelsrichtung: N, NE, E, NW, SW)

| Route | Marke | Ort | Preis-Ereignisse |
|---|---|---|---|
| N | AVIA | Ipsheim | 131.857 |
| NE | AVIA | Nürnberg | 111.210 |
| E | ESSO | Olching | 102.641 |
| NW | AVIA | Mühlhausen | 128.574 |
| SW | RAN | Biberach | 111.145 |

### Feature Engineering

101 Input-Features je Zeitschritt: Lag-Preise (t−1h bis t−168h), gleitende Mittelwerte und Standardabweichungen, Trend, Momentum, zyklische Zeit (Sinus/Kosinus für Stunde und Wochentag), Kalender-Flags (Wochenende, Feiertag).

### Modell

**MLPRegressor** (`scikit-learn`) — Multi-Output-Regression: ein Modell sagt gleichzeitig **5 Stationen × 72 Zeithorizonte = 360 Ausgabewerte** vorher.

Finale Architektur: `hidden_layer_sizes=(32,)`, ReLU, `early_stopping=True`, `learning_rate=adaptive`.

Zeitlicher Datensplit (kein Shuffle):

| Datensatz | Zeitraum | Einträge |
|---|---|---|
| Training | Jun 2014 – Dez 2021 | 66.159 |
| Validierung | Jan 2022 – Dez 2023 | 17.520 |
| Test | Jan 2024 – heute | 20.829 |

## Projektstruktur

```
SpritpreisAnalyse_HSAA_PredAnal/
├── notebooks/
│   └── spedition_mlp.ipynb          # Hauptnotebook (vollständiger CRISP-DM-Ablauf)
├── scripts/
│   ├── data_transform_spedition.py  # SpeditionDataLoader: CSV → Features → Split
│   ├── data_transform.py            # Gemeinsame Konstanten und Hilfsfunktionen
│   ├── model_utils.py               # Training, Evaluation, Dispatch-Empfehlung
│   ├── viz_utils.py                 # Alle Diagramme
│   └── geo_utils.py                 # Haversine, Sektorauswahl
├── data/
│   ├── processed/                   # Parquet-Cache (verhindert wiederholten 87-GB-Scan)
│   └── models/
│       └── spedition_mlp.joblib     # Trainiertes Modell inkl. Scaler
└── docs/
    └── handout-documentation.md     # Vollständige Projektdokumentation
```

## Setup

### Voraussetzungen

```
pandas numpy matplotlib seaborn scikit-learn pyarrow python-dotenv holidays joblib
```

### Datenpfad konfigurieren

Erstelle eine `.env`-Datei im Projektroot:

```
TANKERKOENIG_DATA_PATH=../tankerkoenig-data
```

Die Tankerkönig-Rohdaten (~87 GB) müssen als separates Repository vorhanden sein:

```bash
cd ../tankerkoenig-data && git pull
```

### Modell ausführen

Notebook öffnen und ausführen:

```bash
jupyter lab notebooks/spedition_mlp.ipynb
```

Der `SpeditionDataLoader` liest beim ersten Lauf die CSV-Rohdaten parallel ein und legt einen Parquet-Cache an. Folgeläufe verwenden den Cache.

### Dispatch-Empfehlung

```python
from scripts.model_utils import recommend_cheapest_station

recommend_cheapest_station(model, X_latest, horizon_h=8)
# → Route_NE (€1.901/L) > Route_NW (€1.936/L) > ...
```

## Kurskorrektur

Der ursprüngliche Ansatz (B29-Korridor, regionale Clustervorhersage aus 80 Stationen) wurde verworfen, weil (1) Nowcasting per App das Problem in der Praxis bereits löst und (2) die Mittelwertbildung über viele Stationen das Signal künstlich glättet und gute Metriken erzeugt, ohne echten Modellwert. Begründung vollständig in `docs/handout-documentation.md`, Abschnitt 7.

## Lizenz

Studienprojekt — Hochschule Aalen, nicht für den kommerziellen Einsatz.

**Datenquellen:**
- Tankerkönig Open Data: CC BY 4.0 / BY-NC-SA 4.0
- Bundeskartellamt MTS-K

## Autoren

Daniel Feil u. a. — Predictive Analytics, HS Aalen, Semester 1
