import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import PredictionChart from '../components/charts/PredictionChart'
import { api, FUEL_LABELS, FUEL_COLORS, WEEKDAY_LABELS } from '../services/api'

function HorizonSelector({ value, onChange }) {
  const options = [
    { label: '24 h', value: 24 },
    { label: '48 h', value: 48 },
    { label: '72 h', value: 72 },
  ]
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === o.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Predictions() {
  const [fuelType, setFuelType] = useState('e5')
  const [hours, setHours] = useState(72)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.predictions
      .shortTerm(fuelType, hours)
      .then(setData)
      .finally(() => setLoading(false))
  }, [fuelType, hours])

  const predictions = data?.predictions || []
  const last = predictions[predictions.length - 1]
  const first = predictions[0]
  const trend = last && first ? last.predicted_price - first.predicted_price : 0
  const trendUp = trend >= 0

  // Find best time within forecast
  const best = predictions.reduce(
    (acc, d) => (!acc || d.predicted_price < acc.predicted_price ? d : acc),
    null
  )
  const bestDate = best ? new Date(best.timestamp) : null

  return (
    <div className="flex flex-col h-full">
      <Header title="Prognose" fuelType={fuelType} onFuelTypeChange={setFuelType} />

      <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50">
        {/* Controls + summary */}
        <div className="flex items-start gap-4">
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Aktueller Preis</p>
              <p className="text-2xl font-bold" style={{ color: FUEL_COLORS[fuelType] }}>
                {data?.current_price ? data.current_price.toFixed(3) : '–'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{FUEL_LABELS[fuelType]} · EUR/L</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Preistrend ({hours} h)</p>
              <p className={`text-2xl font-bold ${trendUp ? 'text-red-500' : 'text-green-500'}`}>
                {trendUp ? '▲' : '▼'} {Math.abs(trend).toFixed(3)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">EUR/L Veränderung</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Günstigster Moment</p>
              {bestDate ? (
                <>
                  <p className="text-base font-bold text-green-600">
                    {WEEKDAY_LABELS[bestDate.getDay() === 0 ? 6 : bestDate.getDay() - 1]}.{' '}
                    {bestDate.getHours()}:00 Uhr
                  </p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">
                    {best.predicted_price.toFixed(3)} EUR/L
                  </p>
                </>
              ) : (
                <p className="text-gray-400">–</p>
              )}
            </div>
          </div>

          <HorizonSelector value={hours} onChange={setHours} />
        </div>

        {/* Confidence note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <strong>Hinweis:</strong> Diese Prognose basiert auf historischen Tages- und Wochenmustern.
          Das Konfidenzband weitet sich mit dem Vorhersagehorizont. Echte ML-Modelle (Prophet / LSTM)
          werden nach Einbindung der Tankerkönig-Daten trainiert.
        </div>

        {/* Forecast chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                {hours}-Stunden-Prognose · {FUEL_LABELS[fuelType]}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Linie = Prognose · Schattierung = Konfidenzband
              </p>
            </div>
          </div>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Berechne Prognose…
            </div>
          ) : (
            <PredictionChart
              predictions={predictions}
              fuelType={fuelType}
              currentPrice={data?.current_price}
            />
          )}
        </div>
      </div>
    </div>
  )
}
