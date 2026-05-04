import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import TimeHeatmap from '../components/charts/TimeHeatmap'
import PriceLineChart from '../components/charts/PriceLineChart'
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
      </div>
    </div>
  )
}
