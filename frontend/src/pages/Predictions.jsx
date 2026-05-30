import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import MAEByHorizonChart from '../components/charts/MAEByHorizonChart'
import { api } from '../services/api'

function TabBar({ active, onChange }) {
  const tabs = [
    { value: 'spedition', label: 'Spedition (5 Routen)' },
    { value: 'b29', label: 'B29 Flotte (4 Cluster)' },
  ]
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {tabs.map((t) => (
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

function SpeditionTab({ data }) {
  const recs = data.recommendations || []
  const cheapestRoute = recs[0]?.route

  return (
    <div className="space-y-6">
      {/* Metrics banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-900">{data.model.name}</span>
          <span className="text-xs text-blue-600 font-mono">{data.model.architecture}</span>
          <MetricChip label="MAE" value={`${data.model.mae.toFixed(4)} €/L`} />
          <MetricChip label="R²" value={data.model.r2.toFixed(3)} />
          <MetricChip label="Pick-Acc t+1h" value={`${(data.model.pick_accuracy_t1 * 100).toFixed(0)} %`} />
          <MetricChip label="Zufallsbasis" value={`${(data.model.baseline_pick_accuracy * 100).toFixed(0)} %`} />
          <SavingsBadge text={`€ ${data.savings.per_day_eur.toFixed(0)}/Tag · ${data.savings.trucks} Fahrzeuge`} />
        </div>
      </div>

      {/* Dispatch recommendation table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Dispatch-Empfehlung (Diesel, nächste 72 h)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Route</th>
              <th className="text-left pb-2 font-medium">Station</th>
              <th className="text-right pb-2 font-medium">Entf.</th>
              <th className="text-right pb-2 font-medium">Akt. Preis</th>
              <th className="text-right pb-2 font-medium">Bester Preis</th>
              <th className="text-right pb-2 font-medium">Optimale Zeit</th>
              <th className="text-right pb-2 font-medium">Ersparnis/L</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => {
              const isCheapest = r.route === cheapestRoute
              return (
                <tr
                  key={r.route}
                  className={`border-b border-gray-50 last:border-0 ${isCheapest ? 'bg-green-50' : ''}`}
                >
                  <td className="py-2.5">
                    <span className={`font-semibold ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                      {r.route}
                    </span>
                    {isCheapest && (
                      <span className="ml-2 text-xs bg-green-200 text-green-800 rounded-full px-2 py-0.5 font-medium">
                        Günstigste jetzt
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-700">{r.station_name}</td>
                  <td className="py-2.5 text-right text-gray-500">{r.distance_km} km</td>
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

      {/* Forecast chart + Pick accuracy side by side */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">72-h-Prognose — alle 5 Stationen</h2>
          <p className="text-xs text-gray-400 mb-4">Diesel · Hover für Stundenpreise</p>
          <MultiStationForecastChart stations={data.stations} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h2>
          <p className="text-xs text-gray-400 mb-4">Anteil korrekt vorhergesagter günstigster Stationen</p>
          <PickAccuracyChart
            data={data.pick_accuracy_by_horizon}
            yKey="accuracy"
            yLabel="Pick-Accuracy"
            referenceValue={0.20}
            referenceLabel="Zufallsbasis (20 %)"
            formatY={(v) => `${(v * 100).toFixed(0)} %`}
          />
        </div>
      </div>

      {/* Spearman full width */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Spearman-Rangkorrelation nach Horizont</h2>
        <p className="text-xs text-gray-400 mb-4">
          Wie gut stimmt die vorhergesagte Preisreihenfolge mit der tatsächlichen überein? (ρ = 1 = perfekt)
        </p>
        <PickAccuracyChart
          data={data.spearman_by_horizon}
          yKey="rho"
          yLabel="Spearman ρ"
          referenceValue={0.0}
          referenceLabel="Keine Korrelation"
          formatY={(v) => v.toFixed(2)}
          height={200}
        />
      </div>
    </div>
  )
}

function B29Tab({ data, numTrucks, tankSize, onTrucksChange, onTankSizeChange }) {
  const recs = data.recommendations || []
  const cheapestCluster = recs[0]?.cluster_id

  const SAVINGS_PER_LITER = 0.028
  const savingsPerDay = numTrucks * (tankSize / 100) * 30 * SAVINGS_PER_LITER
  const savingsPerYear = savingsPerDay * 365

  return (
    <div className="space-y-6">
      {/* Metrics banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-blue-900">{data.model.name}</span>
          <span className="text-xs text-blue-600 font-mono">{data.model.architecture}</span>
          <MetricChip label="MAE" value={`${data.model.mae.toFixed(3)} €/L`} />
          <MetricChip label="R²" value={data.model.r2.toFixed(2)} />
          <MetricChip label="Verbesserung" value={`−${data.model.mae_improvement_pct.toFixed(0)} % vs Baseline`} />
          <SavingsBadge text={`€ ${data.savings.per_day_eur.toFixed(2)}/Tag · ${data.savings.trucks} Fahrzeuge`} />
          <SavingsBadge text={`€ ${data.savings.per_year_eur.toLocaleString('de-DE')}/Jahr`} />
        </div>
      </div>

      {/* Cluster recommendation table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Cluster-Empfehlung (Diesel, nächste 72 h)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Cluster</th>
              <th className="text-right pb-2 font-medium">Akt. Preis</th>
              <th className="text-right pb-2 font-medium">Bester Preis</th>
              <th className="text-right pb-2 font-medium">Optimale Zeit</th>
              <th className="text-right pb-2 font-medium">Ersparnis/L</th>
            </tr>
          </thead>
          <tbody>
            {recs.map((r) => {
              const isCheapest = r.cluster_id === cheapestCluster
              const clusterDef = data.clusters.find((c) => c.id === r.cluster_id)
              return (
                <tr
                  key={r.cluster_id}
                  className={`border-b border-gray-50 last:border-0 ${isCheapest ? 'bg-green-50' : ''}`}
                >
                  <td className="py-2.5 flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: clusterDef?.color || '#9ca3af' }}
                    />
                    <span className={`font-semibold ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                      {r.cluster}
                    </span>
                    {isCheapest && (
                      <span className="text-xs bg-green-200 text-green-800 rounded-full px-2 py-0.5 font-medium">
                        Günstigster
                      </span>
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

      {/* Forecast + MAE side by side */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">72-h-Prognose — alle 4 Cluster</h2>
          <p className="text-xs text-gray-400 mb-4">Diesel · B29 Aalen→Stuttgart</p>
          <MultiStationForecastChart stations={data.clusters.map((c) => ({ ...c, name: c.label }))} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">MAE nach Horizont</h2>
          <p className="text-xs text-gray-400 mb-4">MLP [256,128] vs. Persistence Baseline</p>
          <MAEByHorizonChart data={data.mae_by_horizon} />
        </div>
      </div>

      {/* Fleet cost calculator */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Flottenkosten-Kalkulator</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Fahrzeuge: <span className="text-blue-600 font-semibold">{numTrucks}</span>
              </label>
              <input
                type="range" min="1" max="50" value={numTrucks}
                onChange={(e) => onTrucksChange(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>50</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Tankgröße: <span className="text-blue-600 font-semibold">{tankSize} L</span>
              </label>
              <input
                type="range" min="100" max="1000" step="50" value={tankSize}
                onChange={(e) => onTankSizeChange(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>100 L</span><span>1 000 L</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Annahme: 1 Tankvorgang/Fahrzeug/Tag, Einsparung {(SAVINGS_PER_LITER * 100).toFixed(1)} ct/L (Modell-Durchschnitt)
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 content-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Ersparnis pro Tankvorgang</p>
              <p className="text-2xl font-bold text-green-600">
                € {(tankSize * SAVINGS_PER_LITER).toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <p className="text-xs text-gray-500 mb-1">Ersparnis pro Tag ({numTrucks} Fahrzeuge)</p>
              <p className="text-2xl font-bold text-green-700">
                € {savingsPerDay.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-xs text-gray-500 mb-1">Hochrechnung pro Jahr</p>
              <p className="text-2xl font-bold text-green-800">
                € {savingsPerYear.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Predictions() {
  const [activeTab, setActiveTab] = useState('spedition')
  const [speditionData, setSpeditionData] = useState(null)
  const [b29Data, setB29Data] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [numTrucks, setNumTrucks] = useState(25)
  const [tankSize, setTankSize] = useState(500)

  useEffect(() => {
    Promise.all([api.predictions.spedition(), api.predictions.b29()])
      .then(([sp, b29]) => {
        setSpeditionData(sp)
        setB29Data(b29)
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header title="Dispatch-Planung" />

      <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50">
        <TabBar active={activeTab} onChange={setActiveTab} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Fehler: {error}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center text-gray-400 text-sm">
            Lade Prognosen…
          </div>
        )}

        {!loading && activeTab === 'spedition' && speditionData && (
          <SpeditionTab data={speditionData} />
        )}

        {!loading && activeTab === 'b29' && b29Data && (
          <B29Tab
            data={b29Data}
            numTrucks={numTrucks}
            tankSize={tankSize}
            onTrucksChange={setNumTrucks}
            onTankSizeChange={setTankSize}
          />
        )}
      </div>
    </div>
  )
}
