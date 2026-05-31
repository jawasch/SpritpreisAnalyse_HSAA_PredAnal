import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import MAEByHorizonChart from '../components/charts/MAEByHorizonChart'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'

function StepBadge({ n, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
      }`}
    >
      <span className={`text-xs font-mono ${active ? 'text-blue-200' : 'text-gray-400'}`}>{n}</span>
      {label}
    </button>
  )
}

function MetricRow({ label, value, good }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-mono font-semibold ${good ? 'text-green-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

function ModelCard({ model }) {
  const available = model.available !== false
  return (
    <div className={`bg-white rounded-xl border p-4 ${available ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-70'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{model.name}</p>
          <p className="text-xs text-gray-400">{model.subtitle}</p>
        </div>
        {!available && (
          <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Nicht trainiert</span>
        )}
        {available && model.mae && (
          <span className="text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5 font-semibold">
            MAE {model.mae.toFixed(4)}
          </span>
        )}
      </div>
      <div className="font-mono text-xs bg-gray-50 rounded px-2 py-1 text-gray-600 mb-3">
        {model.architecture}
      </div>
      <div className="space-y-1 mb-3">
        {model.mae     != null && <MetricRow label="MAE"              value={`${model.mae.toFixed(4)} €/L`}     good />}
        {model.r2      != null && <MetricRow label="R²"               value={model.r2.toFixed(3)}               good={model.r2 > 0.9} />}
        {model.skill_pct != null && <MetricRow label="Skill-Score"    value={`−${model.skill_pct.toFixed(0)} % vs Baseline`} good />}
        {model.pick_accuracy_t1 != null && (
          <MetricRow label="Pick-Accuracy t+1h" value={`${(model.pick_accuracy_t1 * 100).toFixed(0)} %`} good />
        )}
        {model.n_inputs  != null && <MetricRow label="Input-Features" value={model.n_inputs} />}
        {model.n_outputs != null && <MetricRow label="Ausgaben"       value={model.n_outputs} />}
        {model.horizon_h != null && <MetricRow label="Horizont"       value={`${model.horizon_h} Stunden`} />}
      </div>
    </div>
  )
}

// ── Section: Business Understanding ──────────────────────────────────────────

function SectionBusiness() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Das Geschäftsproblem</h2>
        <p className="text-sm text-gray-600 mb-4">
          Eine Spedition mit 25 LKWs fährt täglich die B29-Route (Aalen → Stuttgart, ~500 km).
          Bei einem Tagesverbrauch von 3.750 L Diesel bedeutet schon eine Preisschwankung
          von <strong>5 ct/L</strong> eine Differenz von <strong>187,50 € pro Tag</strong> — oder
          fast <strong>47.000 € pro Jahr</strong>.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: '25 LKWs', sub: 'Flottengröße' },
            { label: '500 km/Tag', sub: 'Tagesstrecke B29' },
            { label: '3.750 L/Tag', sub: 'Diesel-Verbrauch' },
          ].map(c => (
            <div key={c.label} className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-800">{c.label}</p>
              <p className="text-xs text-blue-600">{c.sub}</p>
            </div>
          ))}
        </div>
        <Eli5 title="Was wollen wir genau lösen?">
          Der Disponent entscheidet morgens: Welcher LKW tankt heute wo?
          Wenn wir wissen, dass Station A in 8 Stunden 3 Cent günstiger sein wird als Station B,
          lohnt es sich, dort hinzufahren. Unser Modell soll genau das vorhersagen:
          die günstigste Station für die nächsten 72 Stunden — und damit den Dispatcher unterstützen.
        </Eli5>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Erfolgsmetrik: Pick-Accuracy</h2>
        <p className="text-sm text-gray-600 mb-3">
          Wie oft sagt das Modell korrekt voraus, welche der 5 Stationen in den nächsten
          N Stunden am günstigsten ist? Bei zufälliger Auswahl: <strong>20 % (1 aus 5)</strong>.
          Unser Modell erreicht <strong>61 % bei t+1h</strong> — 3× besser als Zufall.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Zufallsbasis</p>
            <p className="text-2xl font-bold text-gray-400">20 %</p>
            <p className="text-xs text-gray-400">1 aus 5 Stationen</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-gray-500">Unser Modell (t+1h)</p>
            <p className="text-2xl font-bold text-green-700">61 %</p>
            <p className="text-xs text-green-600">3× besser als Zufall</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section: Data Preparation ─────────────────────────────────────────────────

function SectionDatenVorbereitung() {
  const features = [
    { group: 'Lag-Features', count: '9 × 5 = 45', desc: 'Preise 1h, 2h, 3h, 6h, 12h, 24h, 48h, 72h, 168h zurück', color: 'bg-blue-100 text-blue-700' },
    { group: 'Rolling Stats', count: '6 × 5 = 30', desc: 'Gleitender Mittelwert und Std.-Abw. über 6h, 24h, 48h', color: 'bg-purple-100 text-purple-700' },
    { group: 'Trend/Momentum', count: '2 × 5 = 10', desc: 'Linearer Trend (24h-Fenster), Momentum (t-1h vs t-24h)', color: 'bg-amber-100 text-amber-700' },
    { group: 'Preis t₀', count: '5', desc: 'Aktueller Preis jeder Station zum Zeitpunkt der Vorhersage', color: 'bg-orange-100 text-orange-700' },
    { group: 'Zeitfeatures', count: '6', desc: 'sin/cos Stunde, sin/cos Wochentag, Wochenende, Feiertag', color: 'bg-green-100 text-green-700' },
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Feature Engineering — 101 Eingaben</h2>
        <p className="text-sm text-gray-600 mb-4">
          Rohe Stundenpreise reichen nicht. Das Modell braucht aufbereitete Features,
          die den Kontext erklären: Wie war der Preis gestern? Letzte Woche? Ist gerade Feierabend?
        </p>
        <div className="space-y-2 mb-4">
          {features.map(f => (
            <div key={f.group} className="flex items-start gap-3">
              <span className={`shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded ${f.color}`}>
                {f.count}
              </span>
              <div>
                <span className="text-xs font-semibold text-gray-700">{f.group}:</span>
                <span className="text-xs text-gray-500 ml-1">{f.desc}</span>
              </div>
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
        </Eli5>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Train / Val / Test Split</h2>
        <p className="text-sm text-gray-600 mb-3">
          Zeitreihen-Daten dürfen <strong>nicht zufällig</strong> aufgeteilt werden —
          sonst lernt das Modell von der Zukunft und wird illusorisch gut.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Training', period: '2014–2021', rows: '66.159 Stunden', color: 'bg-blue-50 border-blue-200' },
            { label: 'Validierung', period: '2022–2023', rows: '17.520 Stunden', color: 'bg-purple-50 border-purple-200' },
            { label: 'Test', period: '2024–heute', rows: '20.829 Stunden', color: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-3 ${s.color}`}>
              <p className="text-xs font-semibold text-gray-700">{s.label}</p>
              <p className="text-sm font-bold text-gray-800">{s.period}</p>
              <p className="text-xs text-gray-500">{s.rows}</p>
            </div>
          ))}
        </div>
        <Eli5 title="Warum muss der Test-Datensatz in der Zukunft liegen?" className="mt-3">
          Stell dir vor, du lernst für eine Prüfung und kennst schon die Lösungen.
          Natürlich schneidest du gut ab — aber das beweist nichts für die echte Prüfung.
          Genauso: Das Modell darf die Test-Daten erst nach dem Training sehen.
          2024 ist unser „Prüfungs-Jahr" — da stand das Modell noch auf keinen Daten.
        </Eli5>
      </div>
    </div>
  )
}

// ── Section: Modell B29 ───────────────────────────────────────────────────────

function SectionB29({ b29Data }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-bold text-gray-800">Modell 1: B29 Fleet MLP</h2>
          {!b29Data?.model_available && (
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
              Fallback aktiv — b29_fleet_mlp.ipynb ausführen
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Unser erstes Modell betrachtet die B29-Route als 4 geografische <strong>Cluster</strong>
          (Aalen, Schwäbisch Gmünd, Schorndorf, Stuttgart) — jeder Cluster fasst mehrere Stationen zusammen.
          Multi-Output MLP: <strong>80 Features → 288 Ausgaben</strong> (4 Cluster × 72 Stunden).
        </p>
        <Eli5 title="Warum Cluster statt einzelne Stationen?">
          Auf der B29 gibt es hunderte Tankstellen. Statt jede einzeln zu modellieren,
          fassen wir geografisch nahe Stationen zu Clustern zusammen.
          Das reduziert das Rauschen (eine einzelne Station kann ungewöhnlich sein,
          der Cluster-Durchschnitt ist stabiler) und erfordert weniger Modellparameter.
        </Eli5>
      </div>

      {b29Data && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 4 Cluster</h3>
            <p className="text-xs text-gray-400 mb-4">Diesel · Hover für Stundenpreise</p>
            <MultiStationForecastChart stations={b29Data.clusters?.map(c => ({ ...c, name: c.label })) || []} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">MAE nach Horizont</h3>
            <p className="text-xs text-gray-400 mb-4">MLP vs. Persistence Baseline</p>
            <MAEByHorizonChart data={b29Data.mae_by_horizon} />
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Modell-Architektur</h3>
        <div className="font-mono text-sm text-center py-4 space-x-4 text-gray-700">
          <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded">80 Inputs</span>
          <span className="text-gray-400">→</span>
          <span className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded">256 Neuronen</span>
          <span className="text-gray-400">→</span>
          <span className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded">128 Neuronen</span>
          <span className="text-gray-400">→</span>
          <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded">288 Outputs</span>
        </div>
        <p className="text-xs text-gray-400 text-center">(4 Cluster × 72 Horizonte = 288 Ausgabeneuronen)</p>
      </div>
    </div>
  )
}

// ── Section: Modell Spedition ─────────────────────────────────────────────────

function SectionSpedition({ speditionData }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Modell 2: Spedition MLP — das Template</h2>
        <p className="text-sm text-gray-600 mb-4">
          Präziser als B29: Statt Cluster wählen wir <strong>5 konkrete Tankstellen</strong>
          auf 5 Himmelsrichtungsrouten (N, NE, E, SW, NW), je 80–120 km von Aalen entfernt.
          Station-Discovery: Haversine-Distanz + Sektorzuweisung → bestes Daten-Coverage je Sektor.
          <br className="mb-2" />
          Multi-Output MLP: <strong>101 Features → 360 Ausgaben</strong> (5 Stationen × 72 Stunden).
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            { label: '5 konkrete Stationen', sub: '(statt Cluster-Durchschnitte)' },
            { label: '61 % Pick-Accuracy', sub: 'bei t+1h (Zufall: 20 %)' },
            { label: 'R² = 0,9278', sub: 'auf dem Test-Datensatz 2024+' },
            { label: '€ 17/Tag Ersparnis', sub: 'bei 5 Trucks, 400 L Tankgröße' },
          ].map(c => (
            <div key={c.label} className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-sm font-bold text-green-800">{c.label}</p>
              <p className="text-xs text-green-600">{c.sub}</p>
            </div>
          ))}
        </div>

        <Eli5 title="Warum ist das Speditions-Modell das Template?">
          Dieses Modell zeigt den vollständigen CRISP-DM-Zyklus: Stationsauswahl per Haversine,
          Feature Engineering mit 101 Inputs, Train/Val/Test-Split, Kreuzvalidierung,
          Architekturvergleich (5 Netzgrößen getestet), Bewertung mit Pick-Accuracy + Spearman.
          Jede Folgearbeit (B29-Cluster, All-Germany) baut auf demselben Muster auf —
          deshalb ist `spedition_mlp.ipynb` unser Referenz-Notebook.
        </Eli5>
      </div>

      {speditionData && (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 5 Stationen</h3>
              <p className="text-xs text-gray-400 mb-4">Diesel · Live aus spedition_mlp.joblib</p>
              <MultiStationForecastChart stations={speditionData.stations || []} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
              <p className="text-xs text-gray-400 mb-4">Anteil korrekt vorhergesagter günstigster Stationen</p>
              <PickAccuracyChart
                data={speditionData.pick_accuracy_by_horizon}
                yKey="accuracy"
                yLabel="Pick-Accuracy"
                referenceValue={0.20}
                referenceLabel="Zufall (20 %)"
                formatY={v => `${(v * 100).toFixed(0)} %`}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Spearman-Rangkorrelation</h3>
            <p className="text-xs text-gray-400 mb-4">
              Stimmt die vorhergesagte Preisreihenfolge mit der echten überein? (ρ = 1 = perfekt)
            </p>
            <PickAccuracyChart
              data={speditionData.spearman_by_horizon}
              yKey="rho"
              yLabel="Spearman ρ"
              referenceValue={0.0}
              referenceLabel="Keine Korrelation"
              formatY={v => v.toFixed(2)}
              height={200}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Section: All-Germany ──────────────────────────────────────────────────────

function SectionAllGermany({ models }) {
  const agModels = models?.filter(m => m.id?.startsWith('all_germany')) || []
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Modell 3: All-Germany MLP</h2>
        <p className="text-sm text-gray-600 mb-4">
          Der breiteste Ansatz: Alle 9 Standorte (4 B29-Cluster + 5 Speditions-Stationen)
          kombiniert, alle <strong>3 Kraftstofftypen</strong> (Diesel, E5, E10) als Features.
          Pro Kraftstoff ein eigenes Modell mit <strong>519 Input-Features</strong>.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {agModels.map(m => <ModelCard key={m.id} model={m} />)}
        </div>
        <Eli5 title="Warum 519 Features und 3 separate Modelle?">
          9 Standorte × 3 Kraftstofftypen × (~19 Features pro Kolonne) = 519 Inputs.
          Mehr Daten helfen: Das Modell sieht z. B., dass ein Dieselpreisanstieg in Stuttgart
          oft dem E5-Anstieg in Aalen vorausläuft — solche Korrelationen kann ein Einzelstations-
          modell gar nicht lernen. Drei separate Modelle (statt eines Riesen-Modells) vermeiden,
          dass sich Diesel-Signale und E5-Signale gegenseitig stören.
        </Eli5>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Modell-Architektur (All-Germany)</h3>
        <div className="font-mono text-sm text-center py-4 space-x-4 text-gray-700">
          <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded">519 Inputs</span>
          <span className="text-gray-400">→</span>
          <span className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded">128 Neuronen</span>
          <span className="text-gray-400">→</span>
          <span className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded">64 Neuronen</span>
          <span className="text-gray-400">→</span>
          <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded">N × 72 Outputs</span>
        </div>
        <p className="text-xs text-gray-400 text-center">Ein Modell je Kraftstofftyp (Diesel / E5 / E10)</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Notebooks</h3>
        <p className="text-sm text-blue-700">
          Alle Details, Code und Visualisierungen sind in den Notebooks dokumentiert.
          Die All-Germany-Modelle werden durch <code className="bg-blue-100 px-1 rounded text-xs">all_germany_web_mlp.ipynb</code> erzeugt.
          Unter <strong>Notebooks</strong> (Schritt 06) können sie direkt durchstöbert werden.
        </p>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'business',    label: 'Business Understanding' },
  { id: 'daten',       label: 'Datenvorbereitung' },
  { id: 'b29',         label: 'Modell 1: B29' },
  { id: 'spedition',   label: 'Modell 2: Spedition' },
  { id: 'allgermany',  label: 'Modell 3: All-Germany' },
]

export default function Modellierung() {
  const [step,          setStep]          = useState('business')
  const [speditionData, setSpeditionData] = useState(null)
  const [b29Data,       setB29Data]       = useState(null)
  const [models,        setModels]        = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      api.predictions.spedition().catch(() => null),
      api.predictions.b29().catch(() => null),
      api.models.list().catch(() => null),
    ]).then(([sp, b29, mods]) => {
      setSpeditionData(sp)
      setB29Data(b29)
      setModels(mods?.models || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Schritt 04</span>
          <h1 className="text-xl font-bold text-gray-900">Modellierung</h1>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Der Kern des Projekts: Drei aufeinander aufbauende MLP-Modelle, erklärt von den
          Geschäftszielen bis zur Deployment-Empfehlung.
        </p>
        {/* Step navigation */}
        <div className="flex gap-2 flex-wrap">
          {STEPS.map((s, i) => (
            <StepBadge
              key={s.id}
              n={String(i + 1).padStart(2, '0')}
              label={s.label}
              active={step === s.id}
              onClick={() => setStep(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
              Lade Modelldaten …
            </div>
          )}

          {!loading && step === 'business'   && <SectionBusiness />}
          {!loading && step === 'daten'      && <SectionDatenVorbereitung />}
          {!loading && step === 'b29'        && <SectionB29 b29Data={b29Data} />}
          {!loading && step === 'spedition'  && <SectionSpedition speditionData={speditionData} />}
          {!loading && step === 'allgermany' && <SectionAllGermany models={models} />}
        </div>
      </div>
    </div>
  )
}
