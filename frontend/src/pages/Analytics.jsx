import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import TimeHeatmap from '../components/charts/TimeHeatmap'
import PriceLineChart from '../components/charts/PriceLineChart'
import MAEByHorizonChart from '../components/charts/MAEByHorizonChart'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import { api, FUEL_LABELS, WEEKDAY_LABELS } from '../services/api'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Analytics() {
  const [fuelType, setFuelType] = useState('e5')
  const [heatmap, setHeatmap] = useState(null)
  const [bestTime, setBestTime] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [speditionData, setSpeditionData] = useState(null)
  const [b29Data, setB29Data] = useState(null)

  const [numTrucks, setNumTrucks] = useState(5)
  const [tankSize, setTankSize] = useState(400)
  const [consumption, setConsumption] = useState(28)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.analytics.heatmap(fuelType),
      api.analytics.bestTime(fuelType),
      api.prices.history(fuelType, 90),
    ])
      .then(([hm, bt, hist]) => {
        setHeatmap(hm)
        setBestTime(bt)
        setHistory(hist.data || [])
      })
      .finally(() => setLoading(false))
  }, [fuelType])

  useEffect(() => {
    Promise.all([api.predictions.spedition(), api.predictions.b29()])
      .then(([sp, b29]) => {
        setSpeditionData(sp)
        setB29Data(b29)
      })
      .catch(() => {})
  }, [])

  const days = WEEKDAY_LABELS

  return (
    <div className="flex flex-col h-full">
      <Header title="Analyse" fuelType={fuelType} onFuelTypeChange={setFuelType} />

      <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50">
        {/* Summary stats */}
        {bestTime && (
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Beste Tankzeit"
              value={`${days[bestTime.best_weekday]}, ${bestTime.best_hour}:00`}
              sub={`${bestTime.avg_price_best.toFixed(3)} EUR/L`}
            />
            <StatCard
              label="Schlechteste Zeit"
              value={`Ø ${bestTime.avg_price_worst.toFixed(3)} EUR/L`}
              sub="Teuerste Stunde"
            />
            <StatCard
              label="Durchschnittspreis"
              value={`${bestTime.avg_price_overall.toFixed(3)} EUR/L`}
              sub={FUEL_LABELS[fuelType]}
            />
            <StatCard
              label="Max. Ersparnis"
              value={`${bestTime.potential_savings_eur.toFixed(3)} EUR/L`}
              sub={`${bestTime.potential_savings_percent.toFixed(1)} % günstiger`}
            />
          </div>
        )}

        {/* Insight */}
        {bestTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            💡 {bestTime.insight}
          </div>
        )}

        {/* Heatmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Preismuster nach Uhrzeit und Wochentag
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Grün = günstig, Rot = teuer · Hover für Details
          </p>
          {loading ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              Lade Heatmap…
            </div>
          ) : heatmap ? (
            <TimeHeatmap data={heatmap.data} overallAvg={heatmap.overall_avg} />
          ) : null}
        </div>

        {/* 90-day trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Preisverlauf — 90 Tage ({FUEL_LABELS[fuelType]})
          </h2>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
              Lade…
            </div>
          ) : (
            <PriceLineChart datasets={[{ fuelType, data: history }]} />
          )}
        </div>

        {/* Model performance */}
        {(speditionData || b29Data) && (
          <>
            <div className="border-t border-gray-200 pt-2">
              <h2 className="text-base font-semibold text-gray-800">
                Modellleistung — MLP Prognosequalität
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Basierend auf Spedition MLP (5 Stationen) und B29 Fleet MLP (4 Cluster) — Test 2024–2026
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {b29Data && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">MAE nach Horizont</h3>
                  <p className="text-xs text-gray-400 mb-4">B29 Fleet MLP vs. Persistence Baseline</p>
                  <MAEByHorizonChart data={b29Data.mae_by_horizon} />
                </div>
              )}
              {speditionData && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
                  <p className="text-xs text-gray-400 mb-4">Spedition MLP — günstigste Station korrekt vorhergesagt</p>
                  <PickAccuracyChart
                    data={speditionData.pick_accuracy_by_horizon}
                    yKey="accuracy"
                    yLabel="Pick-Accuracy"
                    referenceValue={0.20}
                    referenceLabel="Zufallsbasis (20 %)"
                    formatY={(v) => `${(v * 100).toFixed(0)} %`}
                  />
                </div>
              )}
            </div>

            {speditionData && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Spearman-Rangkorrelation</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Übereinstimmung vorhergesagter und tatsächlicher Preisreihenfolge (Spedition MLP)
                </p>
                <PickAccuracyChart
                  data={speditionData.spearman_by_horizon}
                  yKey="rho"
                  yLabel="Spearman ρ"
                  referenceValue={0.0}
                  referenceLabel="Keine Korrelation"
                  formatY={(v) => v.toFixed(2)}
                  height={200}
                />
              </div>
            )}

            {/* Fleet cost calculator */}
            <div className="border-t border-gray-200 pt-2">
              <h2 className="text-base font-semibold text-gray-800">Flottenkosten-Kalkulator</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Potenzielle Einsparungen bei optimiertem Dispatch (Modell-Annahme: 2,8 ct/L Durchschnittsersparnis)
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Fahrzeuge: <span className="text-blue-600 font-semibold">{numTrucks}</span>
                    </label>
                    <input
                      type="range" min="1" max="50" value={numTrucks}
                      onChange={(e) => setNumTrucks(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>50</span></div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Tankgröße: <span className="text-blue-600 font-semibold">{tankSize} L</span>
                    </label>
                    <input
                      type="range" min="100" max="1000" step="50" value={tankSize}
                      onChange={(e) => setTankSize(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>100 L</span><span>1 000 L</span></div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Verbrauch: <span className="text-blue-600 font-semibold">{consumption} L/100 km</span>
                    </label>
                    <input
                      type="range" min="20" max="40" value={consumption}
                      onChange={(e) => setConsumption(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>20</span><span>40</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 content-center">
                  {[
                    { label: 'Ersparnis pro Tankvorgang', value: `€ ${(tankSize * 0.028).toFixed(2)}`, color: 'text-gray-800', bg: 'bg-gray-50' },
                    { label: `Ersparnis pro Tag (${numTrucks} Fzg.)`, value: `€ ${(numTrucks * tankSize * 0.028).toFixed(2)}`, color: 'text-green-700', bg: 'bg-green-50 border border-green-100' },
                    { label: 'Hochrechnung pro Jahr', value: `€ ${(numTrucks * tankSize * 0.028 * 365).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`, color: 'text-green-800 font-bold', bg: 'bg-green-100 border border-green-200' },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-lg p-4 ${card.bg}`}>
                      <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                      <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
