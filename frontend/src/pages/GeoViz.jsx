import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

const SCENARIOS = [
  { value: 'all',       label: 'Alle Stationen', desc: '15k Stationen · Preisschätzung + Live im Viewport' },
  { value: 'spedition', label: 'Spedition',       desc: '5 Routen · MLP-Prognose' },
  { value: 'b29',       label: 'B29 Flotte',      desc: '4 Cluster · Korridor-Prognose' },
  { value: 'germany',   label: 'Nat. Modell',     desc: 'Geografisches Grid (nach Training)' },
]

const BUNDESLAENDER = [
  { value: 'all', label: 'Ganz Deutschland', plzPrefix: null },
  { value: 'bw',  label: 'Baden-Württemberg', plzPrefix: ['7', '8'] },
  { value: 'by',  label: 'Bayern',            plzPrefix: ['8', '9'] },
  { value: 'nrw', label: 'Nordrhein-Westfalen', plzPrefix: ['4', '5'] },
  { value: 'he',  label: 'Hessen',            plzPrefix: ['6'] },
  { value: 'ni',  label: 'Niedersachsen',     plzPrefix: ['2', '3'] },
]

export default function GeoViz() {
  const [fuelType, setFuelType]     = useState('diesel')
  const [date, setDate]             = useState('')
  const [scenario, setScenario]     = useState('all')
  const [region, setRegion]         = useState('all')
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const isNonDiesel = fuelType !== 'diesel' && (scenario === 'spedition' || scenario === 'b29')

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.analytics
      .geoTimeseries(fuelType, date || null, 'hour', region, scenario)
      .then(res => { setData(res); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [fuelType, date, scenario, region])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0 space-y-2">
        {/* Row 1: title + fuel + date */}
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-gray-800 shrink-0">3D Geo-Karte</h1>

          <div className="flex gap-1">
            {FUEL_TYPES.map(ft => (
              <button
                key={ft}
                onClick={() => setFuelType(ft)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  fuelType === ft ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {FUEL_LABELS[ft]}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700"
          />
          {date && (
            <button onClick={() => setDate('')} className="text-xs text-gray-400 hover:text-gray-700">
              Heute
            </button>
          )}

          {data?.meta && (
            <span className="ml-auto text-xs text-gray-400">
              {data.meta.n_stations?.toLocaleString('de-DE')} Stationen · {data.meta.date}
              {data.meta.data_source && (
                <span className="ml-1 text-gray-300">· {data.meta.data_source}</span>
              )}
            </span>
          )}
          {error && <span className="ml-auto text-xs text-red-500">{error}</span>}
        </div>

        {/* Row 2: scenario tabs + optional region filter */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {SCENARIOS.map(s => (
              <button
                key={s.value}
                onClick={() => setScenario(s.value)}
                title={s.desc}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  scenario === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {scenario === 'all' && (
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700"
            >
              {BUNDESLAENDER.map(bl => (
                <option key={bl.value} value={bl.value}>{bl.label}</option>
              ))}
            </select>
          )}

          {isNonDiesel && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Modell nur für Diesel — E5/E10 als Näherung
            </span>
          )}

          {scenario === 'germany' && (
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
              Nationales Modell: Notebook <strong>all_germany_web_mlp.ipynb</strong> ausführen
            </span>
          )}
        </div>
      </div>

      {/* Map fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <GeoPriceMap3D
          data={data}
          fuelType={fuelType}
          loading={loading}
          scenario={scenario}
        />
      </div>
    </div>
  )
}
