import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import MAEByHorizonChart from '../components/charts/MAEByHorizonChart'

function TabBar({ active, onChange }) {
  const tabs = [
    { value: 'spedition', label: 'Spedition · 5 Routen' },
    { value: 'b29',       label: 'B29 Flotte · 4 Cluster' },
  ]
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            active === t.value
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function MetricChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2.5 py-0.5 font-medium">
      <span className="text-blue-500">{label}</span>
      {value}
    </span>
  )
}

function SavingsBadge({ text }) {
  return (
    <span className="inline-flex items-center text-xs bg-green-100 text-green-800 rounded-full px-3 py-1 font-semibold">
      {text}
    </span>
  )
}

function FlottenKalkulator({ label, defaultTrucks, defaultTank, savingsPerLiter = 0.028 }) {
  const [numTrucks, setNumTrucks] = useState(defaultTrucks)
  const [tankSize,  setTankSize]  = useState(defaultTank)
  const savingsPerFill = tankSize * savingsPerLiter
  const savingsPerDay  = numTrucks * savingsPerFill
  const savingsPerYear = savingsPerDay * 365

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Flottenkosten-Kalkulator</h3>
      <p className="text-xs text-gray-400 mb-4">
        Potenzielle Einsparungen bei optimiertem Dispatch (Ø {(savingsPerLiter * 100).toFixed(1)} ct/L Modell-Vorteil)
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Fahrzeuge: <span className="text-blue-600 font-semibold">{numTrucks}</span>
            </label>
            <input type="range" min="1" max="50" value={numTrucks}
              onChange={e => setNumTrucks(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>50</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Tankgröße: <span className="text-blue-600 font-semibold">{tankSize} L</span>
            </label>
            <input type="range" min="100" max="1000" step="50" value={tankSize}
              onChange={e => setTankSize(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>100 L</span><span>1 000 L</span></div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Ersparnis pro Tankvorgang', val: `€ ${savingsPerFill.toFixed(2)}`, bg: 'bg-gray-50' },
            { label: `Pro Tag (${numTrucks} Fahrzeuge)`, val: `€ ${savingsPerDay.toFixed(2)}`, bg: 'bg-green-50 border border-green-100' },
            { label: 'Hochrechnung pro Jahr', val: `€ ${savingsPerYear.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`, bg: 'bg-green-100 border border-green-200 font-bold' },
          ].map(c => (
            <div key={c.label} className={`rounded-lg p-3 ${c.bg}`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold text-green-700`}>{c.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DispatchTable({ recs, label }) {
  if (!recs?.length) return null
  const cheapestId = recs[0]?.route || recs[0]?.cluster_id
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{label} (Diesel, nächste 72h)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Station / Cluster</th>
            <th className="text-right pb-2 font-medium">Akt. Preis</th>
            <th className="text-right pb-2 font-medium">Bester Preis</th>
            <th className="text-right pb-2 font-medium">Optimale Zeit</th>
            <th className="text-right pb-2 font-medium">Ersparnis/L</th>
          </tr>
        </thead>
        <tbody>
          {recs.map(r => {
            const id = r.route || r.cluster_id
            const isCheapest = id === cheapestId
            return (
              <tr key={id} className={`border-b border-gray-50 last:border-0 ${isCheapest ? 'bg-green-50' : ''}`}>
                <td className="py-2.5">
                  <span className={`font-semibold ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                    {r.station_name || r.cluster}
                  </span>
                  {isCheapest && (
                    <span className="ml-2 text-xs bg-green-200 text-green-800 rounded-full px-2 py-0.5 font-medium">
                      Günstigste
                    </span>
                  )}
                  {r.distance_km && (
                    <span className="ml-2 text-xs text-gray-400">{r.distance_km} km</span>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-700">{r.current_price.toFixed(3)}</td>
                <td className={`py-2.5 text-right font-mono font-semibold ${isCheapest ? 'text-green-700' : 'text-gray-800'}`}>
                  {r.predicted_best_price.toFixed(3)}
                </td>
                <td className="py-2.5 text-right text-gray-500 text-xs">{r.optimal_time_label}</td>
                <td className="py-2.5 text-right text-green-600 font-mono text-xs">
                  {r.savings_vs_now > 0 ? `−${r.savings_vs_now.toFixed(4)}` : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SpeditionTab({ data }) {
  if (!data) return null
  return (
    <div className="space-y-6">
      {/* Model banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-900">{data.model?.name}</span>
          <span className="text-xs text-blue-600 font-mono">{data.model?.architecture}</span>
          <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 font-semibold">Diesel</span>
          {data.model?.mae      && <MetricChip label="MAE"          value={`${data.model.mae.toFixed(4)} €/L`} />}
          {data.model?.r2       && <MetricChip label="R²"           value={data.model.r2.toFixed(3)} />}
          {data.model?.pick_accuracy_t1 && (
            <MetricChip label="Pick-Acc t+1h" value={`${(data.model.pick_accuracy_t1 * 100).toFixed(0)} %`} />
          )}
          {data.savings && <SavingsBadge text={`€ ${data.savings.per_day_eur?.toFixed(0)}/Tag · ${data.savings.trucks} Fzg.`} />}
        </div>
        {data.parquet_last && (
          <p className="text-xs text-blue-500 mt-1.5">
            Datenstand: {data.parquet_last.slice(0, 10)}
            {data.live_prices_used && ' · Live-Preise eingebunden'}
            {data.inference_error && <span className="text-amber-600"> · Fallback aktiv</span>}
          </p>
        )}
      </div>

      <Eli5 title="Live-Inferenz: So funktioniert das jetzt">
        Diese Seite ruft das echte joblib-Modell auf — keine vorberechneten Ergebnisse.
        Das Backend lädt die letzten 200 Stunden aus dem Speditions-Parquet,
        berechnet 101 Features, skaliert sie, lässt das MLP vorhersagen und
        kehrt die Skalierung um. Das dauert weniger als 1 Sekunde.
      </Eli5>

      <DispatchTable recs={data.recommendations} label="Dispatch-Empfehlung" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 5 Stationen</h3>
          <p className="text-xs text-gray-400 mb-4">Diesel · Hover für Stundenpreise</p>
          <MultiStationForecastChart stations={data.stations || []} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
          <p className="text-xs text-gray-400 mb-4">Test-Datensatz 2024+</p>
          <PickAccuracyChart
            data={data.pick_accuracy_by_horizon}
            yKey="accuracy"
            yLabel="Pick-Accuracy"
            referenceValue={0.20}
            referenceLabel="Zufall (20 %)"
            formatY={v => `${(v * 100).toFixed(0)} %`}
          />
        </div>
      </div>

      <FlottenKalkulator
        label="Spedition"
        defaultTrucks={5}
        defaultTank={400}
        savingsPerLiter={0.028}
      />
    </div>
  )
}

function B29Tab({ data }) {
  if (!data) return null
  return (
    <div className="space-y-6">
      {!data.model_available && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          Kein trainiertes B29-Modell gefunden (<code>data/models/b29_mlp.joblib</code>).
          Prognose basiert auf saisonaler Naive-Methode.
          Notebook <strong>b29_fleet_mlp.ipynb</strong> ausführen, um das Modell zu erzeugen.
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-900">{data.model?.name}</span>
          <span className="text-xs text-blue-600 font-mono">{data.model?.architecture}</span>
          <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 font-semibold">Diesel</span>
          {data.model?.mae != null && <MetricChip label="MAE" value={`${data.model.mae.toFixed(3)} €/L`} />}
          {data.model?.r2  != null && <MetricChip label="R²"  value={data.model.r2.toFixed(2)} />}
          {data.model?.mae_improvement_pct != null && (
            <MetricChip label="vs Baseline" value={`−${data.model.mae_improvement_pct.toFixed(0)} %`} />
          )}
          {data.savings && (
            <>
              <SavingsBadge text={`€ ${data.savings.per_day_eur?.toFixed(2)}/Tag`} />
              <SavingsBadge text={`€ ${data.savings.per_year_eur?.toLocaleString('de-DE')}/Jahr`} />
            </>
          )}
        </div>
        {data.parquet_last && (
          <p className="text-xs text-blue-500 mt-1.5">
            Datenstand: {data.parquet_last.slice(0, 10)}
            {data.inference_error && <span className="text-amber-600"> · Fallback aktiv</span>}
          </p>
        )}
      </div>

      <DispatchTable recs={data.recommendations} label="Cluster-Empfehlung" />

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 4 Cluster</h3>
          <p className="text-xs text-gray-400 mb-4">B29 Aalen → Stuttgart</p>
          <MultiStationForecastChart
            stations={data.clusters?.map(c => ({ ...c, name: c.label })) || []}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">MAE nach Horizont</h3>
          <p className="text-xs text-gray-400 mb-4">MLP vs. Persistence Baseline</p>
          <MAEByHorizonChart data={data.mae_by_horizon} />
        </div>
      </div>

      <FlottenKalkulator
        label="B29 Flotte"
        defaultTrucks={25}
        defaultTank={500}
        savingsPerLiter={0.028}
      />
    </div>
  )
}

export default function Deployment() {
  const [activeTab,     setActiveTab]     = useState('spedition')
  const [speditionData, setSpeditionData] = useState(null)
  const [b29Data,       setB29Data]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)

  useEffect(() => {
    Promise.all([api.predictions.spedition(), api.predictions.b29()])
      .then(([sp, b29]) => {
        setSpeditionData(sp)
        setB29Data(b29)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Schritt 05</span>
          <h1 className="text-xl font-bold text-gray-900">Deployment</h1>
        </div>
        <p className="text-sm text-gray-500">
          Live-Inferenz aus den trainierten joblib-Modellen — kein Mock, echte Vorhersagen.
          Prognose wird bei jedem Seitenaufruf neu berechnet.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto space-y-6">
          <TabBar active={activeTab} onChange={setActiveTab} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              Fehler: {error}
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center text-gray-400 text-sm">
              Lade Live-Prognosen …
            </div>
          )}

          {!loading && activeTab === 'spedition' && <SpeditionTab data={speditionData} />}
          {!loading && activeTab === 'b29'       && <B29Tab data={b29Data} />}
        </div>
      </div>
    </div>
  )
}
