import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

export default function GeoViz() {
  const [fuelType, setFuelType]   = useState('diesel')
  const [date, setDate]           = useState('')         // empty = today (backend default)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.analytics
      .geoTimeseries(fuelType, date || null, 'hour', 'bw')
      .then(res => { setData(res); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [fuelType, date])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">3D Geo-Karte</h1>

        {/* Fuel type selector */}
        <div className="flex gap-1">
          {FUEL_TYPES.map(ft => (
            <button
              key={ft}
              onClick={() => setFuelType(ft)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                fuelType === ft
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {FUEL_LABELS[ft]}
            </button>
          ))}
        </div>

        {/* Date picker */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700"
        />

        {date && (
          <button
            onClick={() => setDate('')}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            Heute
          </button>
        )}

        {/* Info */}
        {data?.meta && (
          <span className="ml-auto text-xs text-gray-400">
            {data.meta.n_stations} Stationen · {data.meta.date}
          </span>
        )}

        {error && (
          <span className="ml-auto text-xs text-red-500">{error}</span>
        )}
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <GeoPriceMap3D data={data} fuelType={fuelType} loading={loading} />
      </div>
    </div>
  )
}
