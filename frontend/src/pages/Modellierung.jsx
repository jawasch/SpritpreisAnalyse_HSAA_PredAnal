import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'
import PixelPattern from '../components/ui/PixelPattern'

const STEPS = [
  { id: 'algorithmus',  label: 'Algorithmus: MLP' },
  { id: 'hyperparam',   label: 'Hyperparameter' },
  { id: 'architektur',  label: 'Architektur-Vergleich' },
  { id: 'cv',           label: 'Cross-Validation' },
]

function StepBadge({ n, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'bg-brand-orange text-white'
          : 'bg-white border border-brand-charcoal/15 text-brand-charcoal hover:border-brand-orange/50'
      }`}
    >
      <span className={`text-xs font-mono ${active ? 'text-white/70' : 'text-brand-charcoal/30'}`}>{n}</span>
      {label}
    </button>
  )
}

// ── Section: Algorithmus ──────────────────────────────────────────────────────

function SectionAlgorithmus({ speditionData }) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Multi-Layer Perceptron (MLP)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Ein MLP bildet nichtlineare Zusammenhänge zwischen Eingangs- und Zielgrößen ab. Es besteht
          aus mehreren Schichten von Neuronen, die über gewichtete Verbindungen gekoppelt sind.
        </p>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Schicht</th>
              <th className="text-left pb-2 font-medium">Allgemein</th>
              <th className="text-left pb-2 font-medium">Im Projekt</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Eingabeschicht', 'nimmt Features auf', '101 Features (Lag, Kalender, Trend)'],
              ['Versteckte Schicht', 'extrahiert Muster', '1 Schicht, 32 Neuronen'],
              ['Ausgabeschicht', 'liefert Vorhersage', '360 Werte (5 Stationen × 72 Horizonte)'],
            ].map(r => (
              <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-semibold text-gray-700">{r[0]}</td>
                <td className="py-2 text-gray-500">{r[1]}</td>
                <td className="py-2 text-gray-700">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="font-mono text-sm text-center py-3 space-x-3 text-gray-700 bg-gray-50 rounded">
          <span className="bg-brand-yellow/40 text-brand-charcoal px-3 py-1.5">101 Inputs</span>
          <span className="text-gray-400">→</span>
          <span className="bg-brand-cyan/30 text-brand-charcoal px-3 py-1.5">32 Neuronen</span>
          <span className="text-gray-400">→</span>
          <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded">360 Outputs</span>
        </div>
      </div>

      {/* Spedition Modell in Aktion */}
      {speditionData && (
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Das Modell in Aktion — 72h-Prognose, 5 Stationen</h3>
          <p className="text-xs text-gray-400 mb-4">Diesel · Live aus spedition_mlp.joblib · Hover für Stundenpreise</p>
          <MultiStationForecastChart stations={speditionData.stations || []} />
        </div>
      )}

      {/* Das Neuron */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-2">Das Neuron</h3>
        <p className="text-sm text-gray-600 mb-3">
          Jedes Neuron berechnet eine gewichtete Summe seiner Eingaben, addiert einen Bias und wendet
          eine Aktivierungsfunktion an:
        </p>
        <p className="font-mono text-center text-base bg-gray-50 rounded py-3 mb-3 text-gray-700">
          a = f( w₁x₁ + w₂x₂ + … + b )
        </p>
        <table className="w-full text-sm mb-3">
          <tbody>
            {[
              ['wᵢ', 'lernbar', 'Wie stark beeinflusst Eingang i das Neuron?'],
              ['b', 'lernbar', 'Verschiebt die Aktivierungsschwelle vom Ursprung'],
              ['f(·)', 'fix (z. B. ReLU)', 'Führt Nichtlinearität ein'],
            ].map(r => (
              <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-mono font-semibold text-brand-orange">{r[0]}</td>
                <td className="py-2 text-gray-500">{r[1]}</td>
                <td className="py-2 text-gray-700">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Eli5 title="Warum braucht es überhaupt eine Aktivierungsfunktion?">
          Ohne Aktivierungsfunktion ist ein beliebig tiefes Netz mathematisch äquivalent zu einer
          einzigen linearen Transformation — die Schichten könnten keine nichtlinearen Muster lernen.
          Dieses Projekt verwendet <strong>ReLU</strong>: f(z) = max(0, z). ReLU wird gegenüber
          Sigmoid bevorzugt, weil ihr Gradient für z &gt; 0 konstant 1 bleibt und das Fehlersignal
          beim Rückpropagieren nicht ausstirbt (<em>Vanishing Gradient</em>).
        </Eli5>
      </div>

      {/* Training */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Training: Die vier Schritte</h3>
        <table className="w-full text-sm mb-3">
          <tbody>
            {[
              ['1', 'Forward Pass', 'Eingabe wird schichtweise verarbeitet → Vorhersage ŷ'],
              ['2', 'Loss', 'Verlustfunktion misst Abweichung: L = (y − ŷ)²'],
              ['3', 'Backpropagation', 'Kettenregel bestimmt den Beitrag jedes Gewichts zum Fehler'],
              ['4', 'Gewichtsupdate', 'w ← w − η · ∂L/∂w'],
            ].map(r => (
              <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-mono font-bold text-brand-orange w-8">{r[0]}</td>
                <td className="py-2 font-semibold text-gray-700 w-40">{r[1]}</td>
                <td className="py-2 text-gray-500">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400">
          <strong>Lernrate η:</strong> Zu groß → Divergenz. Zu klein → langsame Konvergenz.
          In der Praxis: Mini-Batch-Gradientenabstieg (16–256 Beispiele pro Update).
        </p>
      </div>

      {/* Warum MLP + Grenzen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Warum MLP für dieses Problem?</h3>
          <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
            <li><strong>Multi-Output:</strong> Ein Modell sagt alle 5 Stationen × 72 Horizonte gleichzeitig vorher.</li>
            <li><strong>Nichtlinear:</strong> Erfasst Preissprünge, Wochentag-Effekte, Saisonalität.</li>
            <li><strong>Skalierbar:</strong> Anzahl und Größe der Schichten sind anpassbar.</li>
            <li><strong>Weit verbreitet:</strong> Gut dokumentiert, in scikit-learn integriert, reproduzierbar.</li>
          </ul>
        </div>
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Grenzen des Algorithmus</h3>
          <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
            <li>Benötigt viele Trainingsdaten — bei wenig Daten schlechter als einfache Modelle.</li>
            <li>Keine direkte Erklärung, <em>warum</em> eine Vorhersage entsteht (Black Box).</li>
            <li>Hyperparameter-Tuning nötig: falsche Schichtgröße → schlechtere Ergebnisse.</li>
            <li>Externe Einflüsse (Rohölpreis, Steuern) nicht automatisch integriert.</li>
          </ul>
        </div>
      </div>

      {/* Overfitting */}
      <div className="bg-white border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Overfitting erkennen</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="py-2 text-gray-700">Trainingsfehler ↓, Validierungsfehler ↑</td>
              <td className="py-2 text-gray-500">Overfitting — Modell hat Trainingsdaten auswendig gelernt</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-700">Beide Fehler hoch</td>
              <td className="py-2 text-gray-500">Underfitting — Modell zu einfach für das Problem</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">
          Gegenmaßnahmen: Dropout, L2-Regularisierung, Early Stopping.
        </p>
      </div>
    </div>
  )
}

// ── Section: Hyperparameter ───────────────────────────────────────────────────

function SectionHyperparam() {
  const params = [
    ['hidden_layer_sizes', '(32,)', '1 versteckte Schicht mit 32 Neuronen'],
    ['max_iter', '2000', 'Maximale Anzahl Trainingsdurchläufe'],
    ['early_stopping', 'True', 'Stoppt, wenn der Validierungsfehler nicht mehr sinkt'],
    ['n_iter_no_change', '100', 'Wartet 100 Iterationen ohne Verbesserung vor Abbruch'],
    ['learning_rate', 'adaptive', 'Lernrate passt sich automatisch an'],
    ['random_state', '42', 'Reproduzierbarkeit: gleiche Parameter → gleiche Ergebnisse'],
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Hyperparameter des finalen Modells</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Parameter</th>
              <th className="text-left pb-2 font-medium">Wert</th>
              <th className="text-left pb-2 font-medium">Bedeutung</th>
            </tr>
          </thead>
          <tbody>
            {params.map(r => (
              <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-mono text-xs text-brand-charcoal">{r[0]}</td>
                <td className="py-2 font-mono font-semibold text-brand-orange">{r[1]}</td>
                <td className="py-2 text-gray-500 text-xs">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-2">Baseline — was geschlagen werden muss</h3>
        <p className="text-sm text-gray-600 mb-3">
          Als Untergrenze dient ein <strong>DummyRegressor</strong>, der immer den Trainings-
          Durchschnittspreis ausgibt, ohne auf aktuelle Daten zu schauen.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 inline-block">
          <p className="text-xs text-gray-500">Baseline MAE</p>
          <p className="text-2xl font-bold text-gray-700">0,454 €/L</p>
          <p className="text-xs text-gray-400">Referenzwert, der geschlagen werden muss</p>
        </div>
      </div>
    </div>
  )
}

// ── Section: Architektur-Vergleich ────────────────────────────────────────────

function ArchTable({ title, subtitle, rows }) {
  return (
    <div className="bg-white border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-0.5">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{subtitle}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Architektur</th>
            <th className="text-right pb-2 font-medium">MAE</th>
            <th className="text-right pb-2 font-medium">RMSE</th>
            <th className="text-right pb-2 font-medium">Iter.</th>
            <th className="text-right pb-2 font-medium">Parameter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.arch} className={`border-b border-gray-50 last:border-0 ${r.chosen ? 'bg-green-50' : ''}`}>
              <td className={`py-2 font-mono ${r.chosen ? 'font-bold text-green-800' : 'text-gray-700'}`}>
                {r.arch}{r.chosen && ' ←'}
              </td>
              <td className={`py-2 text-right font-mono ${r.chosen ? 'font-bold text-green-700' : 'text-gray-600'}`}>{r.mae}</td>
              <td className="py-2 text-right font-mono text-gray-600">{r.rmse}</td>
              <td className="py-2 text-right font-mono text-gray-400">{r.iter}</td>
              <td className="py-2 text-right font-mono text-gray-400">{r.params}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionArchitektur() {
  const exp1 = [
    { arch: '(32,)', mae: '0,02975', rmse: '0,04061', iter: '1.088', params: '15.144', chosen: true },
    { arch: '(128,)', mae: '0,03227', rmse: '0,04388', iter: '768', params: '59.496' },
    { arch: '(64,)', mae: '0,03445', rmse: '0,04680', iter: '899', params: '29.928' },
    { arch: '(16,)', mae: '0,03457', rmse: '0,04639', iter: '579', params: '7.752' },
    { arch: '(64, 128)', mae: '0,04440', rmse: '0,05731', iter: '1.088', params: '61.288' },
    { arch: '(128, 256)', mae: '0,05227', rmse: '0,06809', iter: '1.056', params: '138.600' },
    { arch: '(64, 128, 256)', mae: '0,05263', rmse: '0,06929', iter: '944', params: '140.392' },
  ]
  const exp2 = [
    { arch: '(32,)', mae: '0,02829', rmse: '0,03921', iter: '91', params: '15.144', chosen: true },
    { arch: '(128,)', mae: '0,03044', rmse: '0,04158', iter: '158', params: '59.496' },
    { arch: '(64,)', mae: '0,03304', rmse: '0,04499', iter: '196', params: '29.928' },
    { arch: '(64, 128)', mae: '0,04423', rmse: '0,05755', iter: '192', params: '61.288' },
    { arch: '(128, 256)', mae: '0,04137', rmse: '0,05409', iter: '204', params: '138.600' },
    { arch: '(64, 128, 256)', mae: '0,04999', rmse: '0,06708', iter: '305', params: '140.392' },
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Architektur-Vergleich</h2>
        <p className="text-sm text-gray-600">
          Sieben Netzwerkgrößen wurden in zwei Experimenten auf dem Validierungsdatensatz verglichen —
          einmal mit geduldigen Trainingsparametern, einmal mit Standardparametern. Alle Werte in €/L.
        </p>
      </div>
      <ArchTable title="Experiment 1 — geduldige Parameter" subtitle="tol=1e-5, n_iter_no_change=100" rows={exp1} />
      <ArchTable title="Experiment 2 — Standardparameter" subtitle="n_iter_no_change=50, max_iter=1000" rows={exp2} />
      <div className="bg-brand-cyan/10 border border-brand-cyan/30 p-5">
        <h3 className="text-sm font-semibold text-brand-charcoal mb-2">Wichtige Beobachtungen</h3>
        <ul className="text-sm text-brand-charcoal/75 space-y-1 list-disc list-inside">
          <li><code className="bg-brand-cyan/20 px-1 text-xs">(32,)</code> gewinnt in beiden Experimenten — ein flaches, schmales Netz reicht aus.</li>
          <li>Tiefere Netze schneiden trotz deutlich mehr Parametern <em>schlechter</em> ab — ein Hinweis auf Overfitting.</li>
          <li>Standard-Parameter liefern sogar leicht bessere Werte (MAE 0,02829 vs. 0,02975) bei einem Bruchteil der Trainingszeit (91 vs. 1.088 Iterationen).</li>
          <li>Es wurde keine ausführliche Hyperparameter-Studie durchgeführt — bessere Konfigurationen sind möglich.</li>
        </ul>
      </div>
    </div>
  )
}

// ── Section: Cross-Validation ─────────────────────────────────────────────────

function SectionCV() {
  const folds = [
    { fold: 'Fold 1', mae: '2,468', rmse: '3,326', r2: '0,781', iter: '676' },
    { fold: 'Fold 2', mae: '2,128', rmse: '2,884', r2: '0,712', iter: '891' },
    { fold: 'Fold 3', mae: '2,479', rmse: '3,200', r2: '0,854', iter: '358' },
    { fold: 'Fold 4', mae: '2,222', rmse: '2,920', r2: '0,923', iter: '535' },
    { fold: 'Fold 5', mae: '2,105', rmse: '2,764', r2: '0,970', iter: '563' },
  ]
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Cross-Validation (TimeSeriesSplit)</h2>
        <p className="text-sm text-gray-600 mb-3">
          Um die Architekturwahl abzusichern, wird ein <strong>TimeSeriesSplit</strong> mit 5 Folds
          auf den Trainingsdaten (Jun 2014 – Dez 2021) durchgeführt.
        </p>
        <Eli5 title="Warum kein klassisches k-Fold?">
          Beim Standard-k-Fold werden die Daten zufällig aufgeteilt — ein Modell könnte dann auf
          Oktober 2020 trainieren und auf März 2018 validieren, also <em>in die Vergangenheit
          schauen</em>. Bei Zeitreihen ist das ein Datenleck. TimeSeriesSplit erzwingt die kausale
          Richtung: das Modell lernt immer auf einem früheren Zeitraum und wird auf einem späteren
          getestet.
        </Eli5>
      </div>

      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Ergebnisse der 5 Folds (Architektur (32,))</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Fold</th>
              <th className="text-right pb-2 font-medium">MAE (ct/L)</th>
              <th className="text-right pb-2 font-medium">RMSE (ct/L)</th>
              <th className="text-right pb-2 font-medium">R²</th>
              <th className="text-right pb-2 font-medium">Iter.</th>
            </tr>
          </thead>
          <tbody>
            {folds.map(r => (
              <tr key={r.fold} className="border-b border-gray-50">
                <td className="py-2 font-semibold text-gray-700">{r.fold}</td>
                <td className="py-2 text-right font-mono text-gray-600">{r.mae}</td>
                <td className="py-2 text-right font-mono text-gray-600">{r.rmse}</td>
                <td className="py-2 text-right font-mono text-gray-600">{r.r2}</td>
                <td className="py-2 text-right font-mono text-gray-400">{r.iter}</td>
              </tr>
            ))}
            <tr className="bg-green-50">
              <td className="py-2 font-bold text-green-800">Ø</td>
              <td className="py-2 text-right font-mono font-bold text-green-700">2,280 ± 0,162</td>
              <td className="py-2 text-right font-mono font-bold text-green-700">3,019 ± 0,210</td>
              <td className="py-2 text-right font-mono font-bold text-green-700">0,848 ± 0,094</td>
              <td className="py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-brand-cyan/10 border border-brand-cyan/30 p-5">
        <h3 className="text-sm font-semibold text-brand-charcoal mb-2">Analyse: Warum streuen die Folds?</h3>
        <p className="text-sm text-brand-charcoal/75 mb-2">
          Der Anstieg von R² über die Folds (0,78 → 0,71 → 0,85 → 0,92 → 0,97) überlagert drei Effekte:
        </p>
        <ol className="text-sm text-brand-charcoal/75 space-y-1 list-decimal list-inside">
          <li><strong>Mehr Trainingsdaten in späteren Folds</strong> — Fold 1 nutzt ~13.000 Stunden, Fold 5 ~55.000.</li>
          <li><strong>Nicht-Stationarität</strong> — Preisregime ändern sich über ein Jahrzehnt; Features sind aufs gelernte Preisniveau kalibriert.</li>
          <li><strong>Nicht-Monotonie Fold 1→2</strong> — Fold 2 hat mehr Daten, aber niedrigeres R²: sein Validierungszeitraum war schwerer vorherzusagen.</li>
        </ol>
        <p className="text-sm text-brand-charcoal/75 mt-2">
          Die R²-Streuung (σ = 0,094) ist beträchtlich — ein klarer Hinweis auf <strong>temporale
          Nicht-Stationarität</strong>: Der Dieselmarkt ist in manchen Perioden strukturell leichter
          vorherzusagen als in anderen. Das ist keine Modellschwäche, sondern eine Eigenschaft des Marktes.
        </p>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Modellierung() {
  const [step,          setStep]          = useState('algorithmus')
  const [speditionData, setSpeditionData] = useState(null)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    api.predictions.spedition()
      .catch(() => null)
      .then(sp => { setSpeditionData(sp); setLoading(false) })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="relative overflow-hidden shrink-0 bg-brand-cyan">
        <PixelPattern color1="rgba(28,28,26,0.10)" color2="transparent" steps={4}
          className="absolute top-0 right-0 pointer-events-none" />
        <div className="px-8 pt-6 pb-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 04 · CRISP-DM · Modeling</p>
          <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Modellierung</h1>
          <p className="text-sm mt-2 text-brand-charcoal/60">
            Das Speditions-MLP — vom Algorithmus über die Architekturwahl bis zur Kreuzvalidierung.
          </p>
        </div>
        <div className="flex gap-0 flex-wrap border-t border-brand-charcoal/10 mt-2">
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
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-brand-cream/60">
        <div className="max-w-5xl mx-auto">
          {loading && step === 'algorithmus' && (
            <div className="bg-white border border-gray-200 p-10 text-center text-gray-400 text-sm mb-6">
              Lade Modelldaten …
            </div>
          )}
          {step === 'algorithmus' && <SectionAlgorithmus speditionData={speditionData} />}
          {step === 'hyperparam'  && <SectionHyperparam />}
          {step === 'architektur' && <SectionArchitektur />}
          {step === 'cv'          && <SectionCV />}
        </div>
      </div>
    </div>
  )
}
