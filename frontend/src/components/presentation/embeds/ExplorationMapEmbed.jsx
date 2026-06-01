import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../../../services/api'
import GeoPriceMap3D from '../../map/GeoPriceMap3D'

const FUEL_TYPES = ['diesel', 'e5', 'e10']
const SCENARIOS = [
  { value: 'spedition_ring', label: 'Auswahl-Ring',         desc: '1 233 Kandidaten je Himmelsrichtung · 5 gewählte hervorgehoben' },
  { value: 'spedition',      label: 'Spedition (5 Routen)', desc: '5 konkrete Stationen · MLP-Prognose 72h' },
  { value: 'b29',            label: 'B29 (4 Cluster)',      desc: 'Korridor Aalen→Stuttgart' },
  { value: 'all',            label: 'Alle Stationen',       desc: '~95 Regionen · Animation über alle Jahre' },
]

/**
 * Live "Modell-Preis-Feld" for the presentation: the same interactive 3D vector
 * map shown on the Data-Exploration page, embedded into the slide flow.
 * `initialScenario` lets a slide open straight on a given view (e.g. the
 * candidate ring for "Optimierungsstrategie").
 */
export default function ExplorationMapEmbed({ initialScenario = 'spedition' }) {
  const [fuelType, setFuelType] = useState('diesel')
  const [scenario, setScenario] = useState(initialScenario)
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const req = scenario === 'all'
      ? api.analytics.regionHistory(fuelType)
      : api.analytics.geoTimeseries(fuelType, null, 'hour', 'all', scenario)
    req.then(res => { setData(res); setLoading(false) })
       .catch(err => { setError(String(err)); setLoading(false) })
  }, [fuelType, scenario])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 shadow-sm overflow-hidden rounded">
      <div className="bg-brand-cyan/15 border-b border-brand-cyan/30 px-4 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex gap-1">
          {SCENARIOS.map(s => (
            <button key={s.value} onClick={() => setScenario(s.value)} title={s.desc}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                scenario === s.value ? 'bg-brand-orange text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {FUEL_TYPES.map(ft => (
            <button key={ft} onClick={() => setFuelType(ft)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                fuelType === ft ? 'bg-brand-charcoal text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
              }`}>
              {FUEL_LABELS[ft]}
            </button>
          ))}
        </div>
        {data?.meta && (
          <span className="ml-auto text-xs text-gray-400">
            {data.meta.n_stations?.toLocaleString('de-DE')} Stationen · {data.meta.date}
          </span>
        )}
        {error && <span className="ml-auto text-xs text-red-500">{error}</span>}
      </div>
      <div className="flex-1 min-h-0 relative">
        <GeoPriceMap3D data={data} fuelType={fuelType} loading={loading} scenario={scenario} />
      </div>
    </div>
  )
}
