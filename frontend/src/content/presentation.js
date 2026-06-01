/**
 * Presentation content — 1:1-Übernahme der Abgabe-Präsentation (Template_PredAnal.pdf,
 * Daniel Feil · Jannis Schuler). Folgt den 6 CRISP-DM-Phasen des PDF
 * (Business → Data → Prep → Modeling → Evaluation → Deployment) + Abschlussfolie.
 *
 * Slide-Felder (alle optional, Default = Text-Folie):
 *   figure   – aufgezeichnetes Asset unter /api/v1/walkthrough-assets/<name>
 *   diagram  – Inline-SVG/HTML-Diagramm-Key (siehe PresentationMode DIAGRAMS)
 *   embed    – Live-Komponente-Key (siehe PresentationMode EMBEDS) — „Switch zur Website"
 *   layout   – 'stats' | 'code' | 'table' | 'statement' | 'numbered'
 *   deepDive – ausklappbarer Vertiefungs-Block (Taste D)
 *
 * PresentationMode baut das Deck: title → übersicht → je Phase (divider + content) → closing.
 */
export const DECK_META = {
  date: '02. Juni 2026',
  title1: 'Spritpreis-Vorhersage',
  title2: 'mit Multi-Layer Perceptron',
  subtitle: 'Eine Geschichte der Unsicherheit',
  authors: 'Daniel Feil · Jannis Schuler',
}

export const CONTENT = [
  // ── 1 · Business Understanding ──────────────────────────────────────────────
  {
    phase: 'business', author: 'Jannis',
    title: 'Business Case',
    body: [
      'Ein Spediteur möchte den optimalen Zeitpunkt für das Betanken seiner LKW-Flotte finden.',
      '25 LKW · 30 L/100 km · 500 km/Tag → die Flotte verbraucht rund 3 750 L Diesel pro Tag.',
      'Preiserhöhungen von wenigen Cent am Tag können so bereits zu dreistelligen Verlusten führen.',
    ],
    diagram: 'businesscase',
  },
  {
    phase: 'business', author: 'Jannis',
    title: 'Optimierungsstrategie',
    body: [
      'Auswahl von 5 Stationen in 5 Himmelsrichtungen (N, NE, E, SW, NW).',
      'Leitfrage: An welcher der fünf Stationen ist Diesel in den nächsten 72 Stunden am günstigsten — und welchen LKW sollten wir dorthin schicken?',
    ],
    embed: 'exploration-map',
  },
  // ── 2 · Data Understanding ──────────────────────────────────────────────────
  {
    phase: 'data', author: 'Daniel',
    title: 'Tankerkönig Database',
    body: ['Open Data: tägliche CSV-Preisänderungen aller deutschen Tankstellen seit 2014.'],
    layout: 'stats',
    stats: [
      { value: '87 GB',       label: 'Historische Daten' },
      { value: '1,1 Mrd.',    label: 'Preiseinträge' },
      { value: '257',         label: 'Verzeichnisse' },
      { value: '4.365',       label: 'Tage' },
      { value: '> 15.000',    label: 'Tankstellen' },
    ],
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Database — Struktur',
    layout: 'code',
    code:
`tankerkoenig-data
├── prices
│   ├── 2014   (06, 07, … 12)
│   ├── 2015   (01, 02, … 12)
│   └── …
└── stations
    ├── 2019   (01, 02, … 12)
    └── …                                    257 Verzeichnisse

# Stationsdaten
uuid,name,brand,street,house_number,post_code,city,latitude,longitude
005056ba-…d12,famila Tankstelle,FAMILA,Pascalstrasse,9,25442,Quickborn,53.74215,9.94124

# Preisdaten
date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change
2025-07-08 00:01:49+02,b78ace98-…9644,1.689,1.829,1.769,1,1,1
2025-07-08 00:01:49+02,83fca0be-…3848,1.578,1.669,1.619,1,0,0`,
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Explorative Datenanalyse — Korrelation',
    body: [
      'Korrelationsmatrix der Dieselpreise über alle fünf Regionen: r > 0,95.',
      'Alle Stationen folgen demselben Takt — der Rohölpreis treibt ganz Deutschland gemeinsam.',
    ],
    figure: 'eda_correlation.png',
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Explorative Datenanalyse — Intraday',
    body: [
      'Intraday-Profil: Preise steigen morgens und fallen abends — ein stabiles tägliches Muster.',
      'Fehlende Stunden füllen wir vorwärts. Dieses Muster ist später ein starkes Feature.',
    ],
    figure: 'eda_intraday.png',
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Live: Zeitliche Muster erkunden',
    body: ['Dieselbe Datenbasis interaktiv — Intraday-Profil und Wochentags-Muster direkt aus dem Backend.'],
    embed: 'exploration-trends',
  },
  // ── 3 · Data Preparation ────────────────────────────────────────────────────
  {
    phase: 'prep', author: 'Jannis',
    title: 'Verarbeitungs-Pipeline',
    body: ['Von 87 GB Rohdaten zum trainierbaren Datensatz — parallel, ohne Datenleck.'],
    diagram: 'pipeline',
  },
  {
    phase: 'prep', author: 'Jannis',
    title: 'Input Features',
    body: ['101 Input-Features je Beobachtungszeitpunkt — pro Station gerechnet.'],
    layout: 'table',
    table: {
      headers: ['Feature-Gruppe', 'Beschreibung'],
      rows: [
        ['Lag-Features', 'Historische Preise zu t−1h, −2h, −3h, −6h, −12h, −24h, −48h, −72h, −168h'],
        ['Gleitender Mittelwert', 'Durchschnittspreis der letzten 6h, 24h, 48h'],
        ['Gleitende Standardabweichung', 'Preisschwankung der letzten 6h, 24h, 48h'],
        ['Trend', 'Lineare Steigung der letzten 24h (steigt oder fällt der Preis?)'],
        ['Momentum', 'Preisänderung zwischen t und t−24h'],
        ['Preis t', 'Aktueller Preis zum Beobachtungszeitpunkt'],
        ['Differenz', 'Preisänderung zwischen t und t−1h'],
        ['Zyklische Zeit', 'Stunde und Wochentag als Sinus/Kosinus kodiert'],
        ['Kalender', 'Binär: Wochenende ja/nein, Feiertag ja/nein'],
      ],
    },
    deepDive: {
      label: 'Warum sin/cos für die Uhrzeit?',
      text: 'Als reine Zahl liegen 23:00 und 0:00 weit auseinander. Sin/Cos macht den Übergang über Mitternacht glatt — das Modell sieht keinen künstlichen Sprung.',
    },
  },
  {
    phase: 'prep', author: 'Jannis',
    title: 'Output Features',
    layout: 'statement',
    statement: '360 Output-Features  =  5 Stationen  ×  72 Zeithorizonte',
  },
  // ── 4 · Modeling ────────────────────────────────────────────────────────────
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Multi-Layer Perceptron',
    body: ['101 Eingaben → eine versteckte Schicht (32 Neuronen) → 360 Ausgaben, voll verbunden.'],
    diagram: 'mlp',
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Neuron',
    body: ['Gewichtete Summe der Eingaben + Bias → ReLU-Aktivierung → Ausgabe.'],
    diagram: 'neuron',
    deepDive: {
      label: 'Wie lernt ein Neuron?',
      text: 'Forward Pass → Loss (y−ŷ)² → Backpropagation (Kettenregel) → Gewichtsupdate w ← w − η·∂L/∂w. ReLU verhindert das Aussterben des Gradienten (Vanishing Gradient).',
    },
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Architekturvergleich — Standardparameter',
    body: [
      'Val MAE / RMSE je Architektur: (32,) gewinnt klar.',
      'Tiefere Netze schneiden trotz vieler mehr Parameter schlechter ab.',
    ],
    figure: 'arch_std.png',
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Architekturvergleich — „Geduldige" Parameter',
    body: [
      'Geduldige Trainingsparameter (n_iter_no_change=100) — dasselbe Bild.',
      'Ein flaches, schmales Netz reicht für dieses Problem aus.',
    ],
    figure: 'arch_patient.png',
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Cross Validation (TimeSeriesSplit)',
    layout: 'code',
    code:
`Fold 1: [——Train (≈13.000 h)——][Val (≈10.700 h)]
Fold 2: [———————Train (≈24.000 h)———————][Val (≈10.700 h)]
Fold 3: [————————————Train (≈35.000 h)————————————][Val (≈10.700 h)]
Fold 4: [—————————————————Train (≈46.000 h)—————————————————][Val (≈10.700 h)]
Fold 5: [——————————————————————Train (≈55.000 h)——————————————————————][Val (≈10.700 h)]`,
    body: ['Immer früher trainieren / später validieren — die kausale Richtung bleibt erhalten.'],
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Cross Validation — Ergebnis',
    body: [
      'CV Fold-Vorhersagen vs. Actual (diesel_Route_N, t+1h).',
      'Ø MAE = 2,28 ct/L. Die Streuung zeigt: manche Marktphasen sind strukturell schwerer.',
    ],
    figure: 'cv_folds.png',
  },
  // ── 5 · Evaluation ──────────────────────────────────────────────────────────
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Testergebnisse',
    layout: 'table',
    table: {
      headers: ['Metrik', 'Baseline (Dummy)', 'MLP Val (32,)', 'MLP Test (32,)'],
      rows: [
        ['MAE', '0,454 €/L', '0,030 €/L', '0,026 €/L'],
        ['RMSE', '0,485 €/L', '0,041 €/L', '0,036 €/L'],
        ['R²', '—', '0,953', '0,955'],
        ['Skill Score', '—', '—', '94,3 %'],
        ['Pick Accuracy (gesamt)', '20 %', '—', '46,0 %'],
        ['Ø Spearman ρ', '—', '—', '0,496'],
      ],
    },
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: '14 Tage Actual vs. Predicted',
    body: [
      'Bei t+72h — dem schwierigsten Horizont — wird der Trend für alle 5 Routen konsistent getroffen.',
      'Preisspitzen werden geglättet statt ausgeschlagen.',
    ],
    figure: 'actual_vs_pred_14d.png',
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Zwei Schichten: Preisniveau ≠ Ranking',
    body: [
      'Qualität des absoluten Preisniveaus: R² = 0,955 · MAE = 2,6 ct/L.',
      'Zuverlässigkeit des Stationsrankings: Pick Accuracy 46 % · Spearman ρ = 0,496.',
    ],
    deepDive: {
      label: 'Warum divergieren die Metriken?',
      text: 'Folgen alle fünf Stationen demselben Trend und unterscheiden sich nur um wenige Cent, reicht eine kleine Fehlvorhersage, um die Rangfolge zu vertauschen — R² bleibt hoch, das Ranking wird schwächer.',
    },
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Cheapest Pick Accuracy',
    body: [
      'Pick-Accuracy je Horizont liegt durchgehend bei ~46 % — deutlich über dem Zufall (20 %).',
      'Am stärksten in den ersten ~24 Stunden.',
    ],
    figure: 'pick_accuracy_horizon.png',
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Kosteneinfluss',
    body: [
      'Basis: 3 750 L/Tag · Pick-Accuracy 46 % · Spread günstigste↔teuerste Station 7,93 ct/L.',
    ],
    layout: 'table',
    table: {
      headers: ['Szenario', 'Berechnung', 'Mehrkosten/Tag'],
      rows: [
        ['Zufall (Baseline)', '7,93 ct × 80 % Miss-Rate × 3 750 L', '237,90 €'],
        ['MLP-Routing', '7,93 ct × 54,0 % Miss-Rate × 3 750 L', '160,73 €'],
        ['Einsparung vs. Zufall', '', '77,17 €/Tag ≈ 19 300 €/Jahr'],
      ],
    },
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Kosteneinfluss — Einschränkungen',
    layout: 'numbered',
    items: [
      'Abhängig vom Spread: für kurzfristige Entscheidungen typischerweise höher als für 72h-Prognosen.',
      'Annahme: Disponent folgt ausschließlich der Modellempfehlung — in der Praxis sind Routenplanung und Fahrzeugdisposition ebenfalls relevant.',
      'Die Simulation geht von gleichmäßiger Auslastung (500 km/Tag je LKW) aus. An Tagen mit geringer Fahrleistung sinkt das Einsparpotenzial entsprechend.',
    ],
  },
  // ── 6 · Deployment ──────────────────────────────────────────────────────────
  {
    phase: 'deployment', author: 'Daniel',
    title: 'CLI-Empfehlung',
    layout: 'code',
    code:
`┌─ Dispatch Recommendation ───────────────────────────────────┐
│ Horizont   : +8h                                            │
│ Günstigste : Route_NE → €1.901/L                            │
│ Ranking    : NE (1.901) > NW (1.936) > N (1.962) > …         │
│ Ersparnis vs. teuerste Station: ~€17.25 / LKW-Befüllung (150 L) │
└─────────────────────────────────────────────────────────────┘`,
  },
  {
    phase: 'deployment', author: 'Daniel',
    title: 'Live-Dispatch — das Modell in Aktion',
    body: [
      'Das Backend lädt das joblib-Modell und rechnet in < 1 s eine 72-Stunden-Prognose für alle fünf Stationen.',
      'Priorisierte Stationsliste mit konkretem Ersparnis-Spread je LKW-Tank (150 L) — live aus echten Vorhersagen.',
    ],
    embed: 'deployment',
  },
  {
    phase: 'deployment', author: 'Daniel',
    title: 'Interaktiv: Kosteneinfluss für die Flotte',
    body: ['Schieberegler für Flottengröße und Tagesverbrauch — die Einsparung skaliert live mit.'],
    embed: 'deployment-calc',
  },
]
