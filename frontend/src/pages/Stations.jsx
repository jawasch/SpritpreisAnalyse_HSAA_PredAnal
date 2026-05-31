import { useState, useEffect, useCallback } from 'react'
import Header from '../components/layout/Header'
import StationMap from '../components/map/StationMap'
import { api, FUEL_COLORS, FUEL_LABELS, DEFAULT_LAT, DEFAULT_LNG } from '../services/api'

const DEFAULT_CENTER = { lat: DEFAULT_LAT, lng: DEFAULT_LNG }

export default function Stations() {
  const [fuelType, setFuelType]   = useState('e5')
  const [stations, setStations]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [sort, setSort]           = useState('dist')
  const [radius, setRadius]       = useState(25)
  const [selected, setSelected]   = useState(null)
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER)
  const [pendingCenter, setPendingCenter] = useState(null)  // map drag candidate
  const [geoloading, setGeoloading] = useState(false)

  const fetchStations = useCallback((center, r, ft, s) => {
    setLoading(true)
    api.stations
      .nearby(center.lat, center.lng, r, ft, s)
      .then((res) => {
        setStations(res.stations || [])
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchStations(searchCenter, radius, fuelType, sort)
  }, [searchCenter, radius, fuelType, sort, fetchStations])

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setGeoloading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setSearchCenter(center)
        setPendingCenter(null)
        setGeoloading(false)
      },
      () => setGeoloading(false),
      { timeout: 8000 }
    )
  }

  const handleMapMove = ({ lat, lng, pending }) => {
    if (pending) setPendingCenter({ lat, lng })
  }

  const handleSearchHere = () => {
    if (!pendingCenter) return
    setSearchCenter(pendingCenter)
    setPendingCenter(null)
  }

  const isCustomCenter =
    Math.abs(searchCenter.lat - DEFAULT_CENTER.lat) > 0.001 ||
    Math.abs(searchCenter.lng - DEFAULT_CENTER.lng) > 0.001

  const prices = stations.map((s) => s[fuelType]).filter((p) => p && p !== false)
  const minPrice = Math.min(...prices)

  const flyCenter = selected ? [selected.lat, selected.lng] : [searchCenter.lat, searchCenter.lng]

  return (
    <div className="flex flex-col h-full">
      <Header title="Tankstellen" fuelType={fuelType} onFuelTypeChange={setFuelType} />

      <div className="flex-1 flex overflow-hidden">
        {/* Map area */}
        <div className="flex-1 p-4 relative">
          {/* "Search here" floating button */}
          {pendingCenter && (
            <div className="absolute top-7 left-1/2 -translate-x-1/2 z-[1000]">
              <button
                onClick={handleSearchHere}
                className="bg-white border border-gray-300 shadow-lg rounded-full px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Stationen hier suchen
              </button>
            </div>
          )}

          <div className="h-full">
            {loading && stations.length === 0 ? (
              <div className="h-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                Lade Karte…
              </div>
            ) : (
              <StationMap
                stations={stations}
                fuelType={fuelType}
                center={flyCenter}
                radius={radius}
                onSearchHere={handleMapMove}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            {/* Geolocation */}
            <button
              onClick={handleGeolocate}
              disabled={geoloading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 border border-blue-200 rounded-lg transition-colors"
            >
              {geoloading ? 'Ortung läuft…' : 'Mein Standort'}
            </button>

            {isCustomCenter && (
              <button
                onClick={() => { setSearchCenter(DEFAULT_CENTER); setPendingCenter(null) }}
                className="w-full text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Zurück zu Aalen
              </button>
            )}

            {/* Radius */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">Radius</label>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-xs font-medium w-10 text-right">{radius} km</span>
            </div>

            {/* Sort */}
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

          {/* Station count / info bar */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>
              {loading ? 'Lade …' : `${stations.length} Tankstellen · ${radius} km`}
            </span>
            {isCustomCenter && (
              <span className="text-blue-600 font-medium">Eigener Standort</span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {error && (
              <div className="p-4 text-xs text-red-500">Fehler: {String(error)}</div>
            )}
            {stations.map((s) => {
              const price = s[fuelType]
              const isCheapest = price === minPrice && price !== false
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
        </div>
      </div>
    </div>
  )
}
