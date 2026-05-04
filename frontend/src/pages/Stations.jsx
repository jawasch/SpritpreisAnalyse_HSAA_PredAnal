import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import StationMap from '../components/map/StationMap'
import { api, FUEL_COLORS, FUEL_LABELS, DEFAULT_LAT, DEFAULT_LNG } from '../services/api'

export default function Stations() {
  const [fuelType, setFuelType] = useState('e5')
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sort, setSort] = useState('dist')
  const [radius, setRadius] = useState(25)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.stations
      .nearby(DEFAULT_LAT, DEFAULT_LNG, radius, fuelType, sort)
      .then((res) => {
        setStations(res.stations || [])
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [fuelType, sort, radius])

  const prices = stations.map((s) => s[fuelType]).filter((p) => p && p !== false)
  const minPrice = Math.min(...prices)

  return (
    <div className="flex flex-col h-full">
      <Header title="Tankstellen" fuelType={fuelType} onFuelTypeChange={setFuelType} />

      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 p-4">
          <div className="h-full">
            {loading ? (
              <div className="h-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                Lade Karte…
              </div>
            ) : (
              <StationMap
                stations={stations}
                fuelType={fuelType}
                center={selected ? [selected.lat, selected.lng] : [DEFAULT_LAT, DEFAULT_LNG]}
                radius={radius}
              />
            )}
          </div>
        </div>

        {/* Station list */}
        <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">Radius</label>
              <input
                type="range"
                min={5}
                max={25}
                step={5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs font-medium w-10 text-right">{radius} km</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">Sortieren</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
              >
                <option value="dist">Entfernung</option>
                <option value="price">Preis</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {error && (
              <div className="p-4 text-xs text-red-500">Fehler: {error}</div>
            )}
            {stations.map((s, i) => {
              const price = s[fuelType]
              const isCheapest = price === minPrice
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selected?.id === s.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate flex items-center gap-1">
                        {isCheapest && (
                          <span className="inline-block bg-green-100 text-green-700 text-[10px] px-1.5 rounded font-bold">
                            Günstigst
                          </span>
                        )}
                        {s.name}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {s.place} · {s.dist} km
                      </div>
                    </div>
                    <div
                      className="text-base font-bold font-mono shrink-0"
                      style={{ color: FUEL_COLORS[fuelType] }}
                    >
                      {price && price !== false ? price.toFixed(3) : '–'}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    {['e5', 'e10', 'diesel'].filter((ft) => ft !== fuelType).map((ft) => (
                      <span key={ft} className="text-[10px] text-gray-400">
                        {FUEL_LABELS[ft]}{' '}
                        <span className="font-mono">
                          {s[ft] && s[ft] !== false ? s[ft].toFixed(3) : '–'}
                        </span>
                      </span>
                    ))}
                    <span
                      className="ml-auto text-[10px] font-medium"
                      style={{ color: s.isOpen ? '#22c55e' : '#ef4444' }}
                    >
                      {s.isOpen ? 'Offen' : 'Zu'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {stations.length} Tankstellen gefunden
          </div>
        </div>
      </div>
    </div>
  )
}
