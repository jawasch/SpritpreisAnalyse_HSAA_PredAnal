import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../../services/api'
import GeoPriceMap3D from './GeoPriceMap3D'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

/**
 * All-stations overview map for Germany: ~95 PLZ regions, averaged price of the chosen
 * fuel, animated over all years. Self-contained (fetches its own data) — used on the
 * Data-Understanding presentation slide to show local correlations & regional differences.
 */
export default function AllStationsMap() {
  const [fuel, setFuel]       = useState('diesel')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.analytics.regionHistory(fuel)
      .then(r => { setData(r?.ok ? r : null); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [fuel])

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <GeoPriceMap3D data={data} fuelType={fuel} loading={loading} scenario="all" />

      {/* Fuel selector (top-left, doesn't overlap the map's own panel on the right) */}
      <div className="absolute top-3 left-3 z-20 flex gap-1 bg-gray-900/85 rounded-lg p-1">
        {FUEL_TYPES.map(ft => (
          <button
            key={ft}
            onClick={() => setFuel(ft)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              fuel === ft ? 'bg-brand-orange text-white' : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            {FUEL_LABELS[ft]}
          </button>
        ))}
      </div>
    </div>
  )
}
