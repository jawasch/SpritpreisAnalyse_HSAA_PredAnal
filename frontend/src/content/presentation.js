/**
 * Presentation content — the story version for Daniel & Jannis.
 * Structure mirrors docs/handout-documentation.md (7 CRISP-DM phases) and the team's slide template.
 * `figure` references a recorded walkthrough asset (served at /api/v1/walkthrough-assets/<name>),
 * matching the handout's image.png … image-7.png exactly.
 *
 * PresentationMode builds the full deck as: title → übersicht → for each phase: divider + content slides.
 */
export const DECK_META = {
  term: 'SoSe 2026',
  title1: 'MLP Regressor',
  title2: 'Spritpreise',
  subtitle: 'Eine Geschichte der Unsicherheit',
  authors: 'Daniel Feil · Jannis Schuler',
}

// Per-phase content slides (dividers are generated from content/phases.js).
export const CONTENT = [
  // ── 1 · Business Understanding ──────────────────────────────────────────────
  {
    phase: 'business', author: 'Jannis',
    title: 'Das Problem der Disposition',
    body: [
      'Eine Spedition betreibt 25 LKWs auf fünf Festrouten, je ~100 km von Aalen entfernt.',
      'Kraftstoff ist die größte variable Kostenposition — der Disponent entscheidet täglich, welcher LKW wo tankt.',
      'Leitfrage: An welcher der fünf Stationen ist Diesel in den nächsten 72 Stunden am günstigsten?',
    ],
  },
  {
    phase: 'business', author: 'Jannis',
    title: 'Warum sich das lohnt',
    body: [
      'Jeder LKW fährt max. 500 km/Tag → 150 L Diesel. Flotte: 3 750 L/Tag.',
      'Schon 2 ct/L Preisvorteil = 75 €/Tag ≈ 18 750 €/Jahr (250 Arbeitstage).',
      'Erfolg messen wir mit der Pick Accuracy: trifft das Modell die wirklich günstigste Station? Zufall = 20 %.',
    ],
    deepDive: {
      label: 'Kurskorrektur',
      text: 'Der ursprüngliche B29-Korridor-Ansatz (regionale Cluster) wurde verworfen — siehe Phase 7. Dies ist der überarbeitete Business Case mit fünf konkreten Stationen.',
    },
  },
  // ── 2 · Data Understanding ──────────────────────────────────────────────────
  {
    phase: 'data', author: 'Daniel',
    title: 'Tankerkönig Open Data',
    body: [
      '~87 GB CSV, 1,1 Milliarden Preiseinträge über 4 365 Tage, > 15 000 Tankstellen.',
      'Aus 1 233 Kandidaten im Ring 80–120 km wählen wir je Himmelsrichtung die Station mit den meisten Preisdaten — per Haversine-Distanz.',
    ],
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Befund 1 — alles hängt zusammen',
    body: [
      'Die fünf Stationen sind extrem hoch korreliert (r > 0,95): der Rohölpreis treibt alle gemeinsam.',
      'Lokale Unterschiede sind klein — aber genau die wollen wir vorhersagen.',
    ],
    figure: 'eda_correlation.png',
  },
  {
    phase: 'data', author: 'Daniel',
    title: 'Befund 2 — der Tagesrhythmus',
    body: [
      'Preise steigen morgens und fallen abends — ein stabiles tägliches Muster.',
      'Fehlende Stunden füllen wir vorwärts. Dieses Muster ist später ein starkes Feature.',
    ],
    figure: 'eda_intraday.png',
  },
  // ── 3 · Data Preparation ────────────────────────────────────────────────────
  {
    phase: 'prep', author: 'Jannis',
    title: '101 Features → 360 Ziele',
    body: [
      'Pro Station: Lags, gleitende Mittel/Std, Trend, Momentum, zyklische Zeit (sin/cos) und Kalender → 101 Features.',
      'Das Modell sagt gleichzeitig 5 Stationen × 72 Stunden = 360 Werte vorher.',
    ],
    deepDive: {
      label: 'Warum sin/cos für die Uhrzeit?',
      text: 'Als reine Zahl liegen 23:00 und 0:00 weit auseinander. Sin/Cos macht den Übergang über Mitternacht glatt — das Modell sieht keinen künstlichen Sprung.',
    },
  },
  {
    phase: 'prep', author: 'Jannis',
    title: 'Zeitlich splitten — kein Datenleck',
    body: [
      'Train 2014–2021 (66 159) · Validierung 2022–2023 (17 520) · Test 2024+ (20 829).',
      'Der StandardScaler wird nur auf Train gefittet. Sonst flössen Zukunftsinfos ins Training.',
    ],
  },
  // ── 4 · Modeling ────────────────────────────────────────────────────────────
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Multi-Layer Perceptron (32,)',
    body: [
      '101 Eingaben → eine versteckte Schicht mit 32 Neuronen → 360 Ausgaben.',
      'Baseline (DummyRegressor) liegt bei 0,454 €/L — das muss geschlagen werden.',
    ],
    deepDive: {
      label: 'Wie lernt ein Neuron?',
      text: 'Forward Pass → Loss (y−ŷ)² → Backpropagation (Kettenregel) → Gewichtsupdate w ← w − η·∂L/∂w. ReLU verhindert das Aussterben des Gradienten (Vanishing Gradient).',
    },
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Architektur-Vergleich — Experiment 1',
    body: [
      'Geduldige Trainingsparameter (n_iter_no_change=100): (32,) gewinnt klar.',
      'Tiefere Netze schneiden trotz vieler mehr Parameter schlechter ab.',
    ],
    figure: 'arch_patient.png',
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Architektur-Vergleich — Experiment 2',
    body: [
      'Standardparameter — dasselbe Bild: (32,) ist vorne, deeper overfittet.',
      'Ein flaches, schmales Netz reicht für dieses Problem aus.',
    ],
    figure: 'arch_std.png',
  },
  {
    phase: 'modeling', author: 'Daniel',
    title: 'Cross-Validation (TimeSeriesSplit)',
    body: [
      'Fünf Folds, immer früher trainieren / später validieren — die kausale Richtung bleibt erhalten.',
      'Ø R² = 0,85 ± 0,09. Die Streuung zeigt: manche Marktphasen sind strukturell schwerer.',
    ],
    figure: 'cv_folds.png',
  },
  // ── 5 · Evaluation ──────────────────────────────────────────────────────────
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Testergebnis 2024+',
    body: [
      'MAE 0,026 €/L · RMSE 0,036 €/L · R² 0,955 · Skill Score 94,3 % gegenüber der Baseline.',
      'Der Testfehler ist sogar kleiner als der Validierungsfehler — die Energiekrise 2022/23 war schwerer.',
    ],
    figure: 'mae_rmse_horizon.png',
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Preisniveau ≠ Ranking',
    body: [
      'Pick Accuracy 46 % (Zufall 20 %), am besten bei t+24h. Spearman ρ = 0,496.',
      'Das Modell trifft das Preisniveau sehr gut — die feinen Unterschiede zwischen Stationen sind viel schwerer.',
    ],
    figure: 'pick_accuracy_horizon.png',
    deepDive: {
      label: 'Warum divergieren die Metriken?',
      text: 'Folgen alle fünf Stationen demselben Trend und unterscheiden sich nur um wenige Cent, reicht eine kleine Fehlvorhersage, um die Rangfolge zu vertauschen — R² bleibt hoch, das Ranking wird schwächer.',
    },
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: '14 Tage Actual vs. Predicted',
    body: [
      'Bei t+72h — dem schwierigsten Horizont — wird der Trend konsistent getroffen.',
      'Preisspitzen werden geglättet statt ausgeschlagen: das erklärt das hohe R² bei schwächerem Ranking.',
    ],
    figure: 'actual_vs_pred_14d.png',
  },
  {
    phase: 'evaluation', author: 'Jannis',
    title: 'Kosten-Impact',
    body: [
      'Ø Spread günstigste↔teuerste Station: 7,93 ct/L.',
      'MLP-Routing spart ggü. Zufall ≈ 77 €/Tag ≈ 19 300 €/Jahr für die Flotte.',
    ],
  },
  // ── 6 · Deployment ──────────────────────────────────────────────────────────
  {
    phase: 'deployment', author: 'Daniel',
    title: 'Live-Dispatch',
    body: [
      'Das Backend lädt das joblib-Modell und rechnet in < 1 s eine 72-Stunden-Prognose für alle fünf Stationen.',
      'Der Disponent bekommt eine priorisierte Stationsliste mit dem konkreten Ersparnis-Spread je LKW-Tank (150 L).',
    ],
  },
  // ── 7 · Reflexion ───────────────────────────────────────────────────────────
  {
    phase: 'reflexion', author: 'Daniel & Jannis',
    title: 'Warum wir B29 verworfen haben',
    body: [
      'Der erste Ansatz mittelte bis zu 80 Stationen je Region zu 4 Clustern.',
      'Problem 1: kein Mehrwert gegenüber Echtzeit-Apps — Nowcasting hätte gereicht.',
      'Problem 2: die Mittelung glättet den Preis künstlich — gute Metriken wären nur ein Artefakt gewesen.',
    ],
  },
  {
    phase: 'reflexion', author: 'Daniel & Jannis',
    title: 'Stärken, Grenzen, Ausblick',
    body: [
      'Stärken: große konsistente Datenbasis, automatisierte Stationsauswahl, kein Datenleck, voll reproduzierbar.',
      'Grenzen: nur 5 feste Stationen, keine Live-API, externe Treiber (Rohöl) fehlen noch.',
      'Ausblick: All-Germany-Modell (519 Features) als nächste Ausbaustufe.',
    ],
  },
]
