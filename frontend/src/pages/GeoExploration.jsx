import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'
import Eli5 from '../components/Eli5'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

const SCENARIOS = [
  { value: 'all',       label: 'Alle Stationen', desc: '15k Stationen · Preisschätzung aus Parquet' },
  { value: 'spedition', label: 'Spedition',       desc: '5 Routen · MLP-Prognose (72h)' },
  { value: 'b29',       label: 'B29 Flotte',      desc: '4 Cluster · Korridor Aalen→Stuttgart' },
  { value: 'germany',   label: 'Nationales Modell', desc: 'All-Germany MLP (Notebook ausführen)' },
]

const BUNDESLAENDER = [
  { value: 'all', label: 'Ganz Deutschland' },
  { value: 'bw',  label: 'Baden-Württemberg' },
  { value: 'by',  label: 'Bayern' },
  { value: 'nrw', label: 'NRW' },
  { value: 'he',  label: 'Hessen' },
  { value: 'ni',  label: 'Niedersachsen' },
]

export default function GeoExploration() {
  const [fuelType,  setFuelType]  = useState('diesel')
  const [date,      setDate]      = useState('')
  const [scenario,  setScenario]  = useState('all')
  const [region,    setRegion]    = useState('all')
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [showEli5,  setShowEli5]  = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.analytics
      .geoTimeseries(fuelType, date || null, 'hour', region, scenario)
      .then(res => { setData(res); setLoading(false) })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [fuelType, date, scenario, region])

  const isNonDiesel = fuelType !== 'diesel' && (scenario === 'spedition' || scenario === 'b29')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0 space-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">02</span>
            <h1 className="text-sm font-semibold text-gray-800">Geo-Exploration</h1>
          </div>

          {/* Fuel type */}
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

          {/* Date */}
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

          {/* Meta */}
          {data?.meta && (
            <span className="ml-auto text-xs text-gray-400">
              {data.meta.n_stations?.toLocaleString('de-DE')} Stationen · {data.meta.date}
              {data.meta.data_source && <span className="ml-1 text-gray-300">· {data.meta.data_source}</span>}
            </span>
          )}
          {error && <span className="ml-auto text-xs text-red-500">{error}</span>}

          {/* ELI5 toggle */}
          <button
            onClick={() => setShowEli5(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showEli5 ? '▲ ELI5 einklappen' : '▼ ELI5 erklären'}
          </button>
        </div>

        {/* Scenario tabs + region */}
        <div className="flex items-center gap-3 flex-wrap">
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

          {scenario === 'germany' && !data?.meta?.model_available && (
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
              Nationales Modell: <strong>all_germany_web_mlp.ipynb</strong> ausführen
            </span>
          )}
        </div>

        {/* ELI5 panel */}
        {showEli5 && (
          <Eli5 title={`Szenario: ${SCENARIOS.find(s => s.value === scenario)?.label}`}>
            {scenario === 'all' && (
              <>
                <strong>Alle Stationen:</strong> Jeder Pfeil steht für eine der 15.000+ deutschen Tankstellen.
                Die <strong>Länge des Pfeils</strong> zeigt den aktuellen Dieselpreis — längerer Pfeil = teurer.
                Grün = günstig, Rot = teuer. Die Preise werden aus dem B29-Parquet geschätzt und mit
                markenspezifischen Offsets (z. B. Shell teurer als JET) angepasst.
              </>
            )}
            {scenario === 'spedition' && (
              <>
                <strong>Speditions-Szenario:</strong> 5 konkrete Tankstellen auf 5 Himmelsrichtungsrouten
                ab Aalen (80–120 km). Die Pfeile zeigen die MLP-Vorhersage für die nächsten 72 Stunden.
                Die Linien zeigen die Routen vom Standort Aalen zu jeder Station.
                Unser Modell (101 Features → 360 Ausgaben) sagt voraus, welche Station wann am günstigsten ist.
              </>
            )}
            {scenario === 'b29' && (
              <>
                <strong>B29-Flotten-Szenario:</strong> 4 geografische Cluster entlang der B29 (Aalen–Stuttgart).
                Jeder Cluster aggregiert mehrere Tankstellen in einem PLZ-Gebiet.
                Das B29-MLP (80 Features → 288 Ausgaben) sagt die Preisentwicklung je Cluster voraus.
              </>
            )}
            {scenario === 'germany' && (
              <>
                <strong>Nationales Modell:</strong> Das All-Germany-MLP kombiniert alle 9 Standorte
                (B29-Cluster + Speditions-Stationen) mit 519 Features für alle 3 Kraftstofftypen.
                Breitere Datenbasis = bessere Generalisierung.
              </>
            )}
          </Eli5>
        )}
      </div>

      {/* Map */}
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
