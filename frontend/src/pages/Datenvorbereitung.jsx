import Eli5 from '../components/Eli5'
import PixelPattern from '../components/ui/PixelPattern'

const PIPELINE = [
  '87 GB CSV-Dateien (parallel einlesen)',
  'Filterung auf 5 Stations-UUIDs',
  'Stündliche Aggregation je Station',
  'Vorwärtsfüllung fehlender Stunden',
  'Feature Engineering (101 Features)',
  'Normierung (StandardScaler)',
  'Zeitlicher Split: Train | Val | Test',
]

const FEATURES = [
  { group: 'Lag-Features', desc: 'Historische Preise t−1h, −2h, −3h, −6h, −12h, −24h, −48h, −72h, −168h', color: 'bg-brand-cyan/25 text-brand-charcoal' },
  { group: 'Gleitender Mittelwert', desc: 'Durchschnittspreis der letzten 6h, 24h, 48h', color: 'bg-brand-yellow/40 text-brand-charcoal' },
  { group: 'Gleitende Std.-Abw.', desc: 'Preisschwankung der letzten 6h, 24h, 48h', color: 'bg-brand-yellow/40 text-brand-charcoal' },
  { group: 'Trend', desc: 'Lineare Steigung der letzten 24h (steigt/fällt der Preis?)', color: 'bg-amber-100 text-amber-700' },
  { group: 'Momentum', desc: 'Preisänderung zwischen t und t−24h', color: 'bg-amber-100 text-amber-700' },
  { group: 'Preis t', desc: 'Aktueller Preis zum Beobachtungszeitpunkt', color: 'bg-orange-100 text-orange-700' },
  { group: 'Differenz', desc: 'Preisänderung zwischen t und t−1h', color: 'bg-orange-100 text-orange-700' },
  { group: 'Zyklische Zeit', desc: 'Stunde und Wochentag als Sinus/Kosinus kodiert', color: 'bg-green-100 text-green-700' },
  { group: 'Kalender', desc: 'Binär: Wochenende ja/nein, Feiertag ja/nein', color: 'bg-green-100 text-green-700' },
]

const SPLIT = [
  { label: 'Training',    period: 'Jun 2014 – Dez 2021', rows: '66.159', color: 'bg-brand-yellow/30 border-brand-yellow/60' },
  { label: 'Validierung', period: 'Jan 2022 – Dez 2023', rows: '17.520', color: 'bg-brand-cyan/20 border-brand-cyan/40' },
  { label: 'Test',        period: 'Jan 2024 – heute',    rows: '20.829', color: 'bg-green-50 border-green-200' },
]

export default function Datenvorbereitung() {
  return (
    <div className="flex flex-col h-full overflow-auto bg-brand-cream">
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-yellow">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 03 · CRISP-DM · Data Preparation</p>
        <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Datenvorbereitung</h1>
        <p className="text-sm mt-2 text-brand-charcoal/60 max-w-xl">
          Von 87 GB Rohdaten zu 101 sauberen Features — und einem zeitlich korrekten Split,
          der kein Datenleck zulässt.
        </p>
        <PixelPattern color1="rgba(28,28,26,0.12)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Pipeline */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Verarbeitungspipeline</h2>
          <p className="text-sm text-gray-600 mb-4">
            Die gesamte Vorbereitung ist in der Klasse <code className="bg-gray-100 px-1 text-xs">SpeditionDataLoader</code> gekapselt.
            Paralleles CSV-Einlesen (<code className="bg-gray-100 px-1 text-xs">ThreadPoolExecutor</code>) und ein
            <strong> Parquet-Cache</strong> verhindern, dass der 87-GB-Scan bei jeder Ausführung wiederholt wird.
          </p>
          <div className="flex flex-col items-center gap-1">
            {PIPELINE.map((step, i) => (
              <div key={step} className="flex flex-col items-center w-full">
                <div className="w-full max-w-md text-center text-sm font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700">
                  {step}
                </div>
                {i < PIPELINE.length - 1 && <span className="text-gray-300">↓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Feature Engineering */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Feature Engineering — 101 Eingaben</h2>
          <p className="text-sm text-gray-600 mb-4">
            Rohe Stundenpreise reichen nicht. Pro Zeitschritt und Station werden folgende Merkmale
            berechnet — insgesamt <strong>101 Input-Features</strong> für das Modell.
          </p>
          <div className="space-y-2 mb-4">
            {FEATURES.map(f => (
              <div key={f.group} className="flex items-start gap-3">
                <span className={`shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded ${f.color}`}>
                  {f.group}
                </span>
                <span className="text-xs text-gray-500">{f.desc}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <span className="shrink-0 text-sm font-bold text-gray-800 px-2 py-0.5 bg-gray-100 rounded">101</span>
              <span className="text-xs font-semibold text-gray-600">Features gesamt</span>
            </div>
          </div>
          <Eli5 title="Warum Sinus und Kosinus für die Uhrzeit?">
            Stell dir die Uhr als Kreisbewegung vor. Von 23:00 auf 0:00 ist nur 1 Stunde —
            aber als Zahl wäre das ein Sprung von 23 auf 0. Das Modell würde denken,
            das sei weit auseinander. Wenn wir stattdessen Sinus und Kosinus nehmen,
            landen 23:00 und 0:00 nah beieinander auf dem Kreis — genau richtig.
            Dasselbe Prinzip gilt für den Wochentag.
          </Eli5>
        </div>

        {/* Zeitlicher Split */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Zeitlicher Datensplit</h2>
          <p className="text-sm text-gray-600 mb-3">
            <strong>Wichtig:</strong> Zeitreihendaten dürfen nicht zufällig durchmischt werden —
            sonst würde das Modell „in die Zukunft schauen" und unrealistisch gute Ergebnisse
            erzielen. Stattdessen wird strikt chronologisch aufgeteilt.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-2">
            {SPLIT.map(s => (
              <div key={s.label} className={`rounded-lg border p-3 ${s.color}`}>
                <p className="text-xs font-semibold text-gray-700">{s.label}</p>
                <p className="text-sm font-bold text-gray-800">{s.period}</p>
                <p className="text-xs text-gray-500">{s.rows} Einträge</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Gesamt: 104.508 Einträge</p>
          <Eli5 title="Warum muss der Test-Datensatz in der Zukunft liegen?" className="mt-3">
            Stell dir vor, du lernst für eine Prüfung und kennst schon die Lösungen.
            Natürlich schneidest du gut ab — aber das beweist nichts für die echte Prüfung.
            Genauso: Das Modell darf die Test-Daten erst nach dem Training sehen.
            2024–2026 ist unser „Prüfungs-Zeitraum" — da stand das Modell auf keinen Daten.
          </Eli5>
        </div>

        {/* Normierung */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Normierung &amp; Zielvariable</h2>
          <p className="text-sm text-gray-600 mb-3">
            Alle Features werden mit dem <strong>StandardScaler</strong> auf Mittelwert 0 und
            Standardabweichung 1 normiert — damit kein Merkmal allein durch seine Größenordnung das
            Training dominiert. Kritisch: Der Scaler wird <strong>ausschließlich auf den
            Trainingsdaten</strong> angepasst (<code className="bg-gray-100 px-1 text-xs">fit</code>) und auf
            Validierung und Test nur angewendet (<code className="bg-gray-100 px-1 text-xs">transform</code>).
            Würde man ihn auf allen Daten anpassen, flössen Zukunftsinformationen ins Training — ein
            <strong> Datenleck</strong>.
          </p>
          <div className="bg-brand-cyan/15 border border-brand-cyan/40 p-4">
            <p className="text-sm text-brand-charcoal">
              <strong>Ziel-Features:</strong> Pro Zeitschritt sagt das Modell gleichzeitig
              <strong> 5 Stationen × 72 Zeithorizonte = 360 Ausgabewerte</strong> vorher
              (Multi-Output-Regression). Das Ziel-DataFrame <code className="bg-brand-cyan/30 px-1 text-xs">y</code> hat
              also 360 Spalten.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
