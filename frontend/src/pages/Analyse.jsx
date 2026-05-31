import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'
import Eli5 from '../components/Eli5'
import PriceLineChart from '../components/charts/PriceLineChart'
import PixelPattern from '../components/ui/PixelPattern'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

// Only model-output scenarios — raw data exploration is on /karte
const MODEL_SCENARIOS = [
  {
    value: 'spedition',
    label: 'Spedition',
    desc: '5 Routen · MLP-Prognose 72h',
    eli5: 'Das Speditions-MLP (101 Features → 360 Ausgaben) sagt voraus, ' +
      'welche der 5 Tankstellen wann am günstigsten ist. ' +
      'Jeder Vektor zeigt eine Station — Länge = vorhergesagter Preis, ' +
      'Farbe = günstig (grün) bis teuer (rot). ' +
      'Der Zeit-Slider bewegt dich durch die 72h-Prognose.',
  },
  {
    value: 'b29',
    label: 'B29 Flotte',
    desc: '4 Cluster · Aalen→Stuttgart',
    eli5: 'Das B29-MLP (80 Features → 288 Ausgaben) sagt Preise für 4 geografische ' +
      'Cluster entlang der B29 voraus. Jeder Cluster fasst mehrere Tankstellen ' +
      'in einem PLZ-Gebiet zusammen — stabiler als einzelne Stationen.',
  },
  {
    value: 'germany',
    label: 'All-Germany',
    desc: 'Nationales Modell (519 Features)',
    eli5: 'Das All-Germany-MLP kombiniert alle 9 Standorte mit 519 Features ' +
      'für alle 3 Kraftstofftypen. Es lernt Wechselwirkungen zwischen Regionen: ' +
      'Ein Preisanstieg in Stuttgart kann dem E5-Anstieg in Aalen vorausgehen.',
  },
]

export default function Analyse() {
  const [fuelType, setFuelType] = useState('diesel')
  const [scenario, setScenario] = useState('spedition')
  const [geoData,  setGeoData]  = useState(null)
  const [oilData,  setOilData]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [showEli5, setShowEli5] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.analytics.geoTimeseries(fuelType, null, 'hour', 'all', scenario),
      api.oil.history(90).catch(() => null),
    ]).then(([geo, oil]) => {
      setGeoData(geo)
      setOilData(oil)
      setLoading(false)
    }).catch(err => {
      setError(String(err))
      setLoading(false)
    })
  }, [fuelType, scenario])

  const oilDelta = (() => {
    if (!oilData?.data?.length) return 0
    const d = oilData.data
    const last = d[d.length - 1]?.price_usd_bbl ?? 0
    const prev = d[Math.max(0, d.length - 3)]?.price_usd_bbl ?? last
    return parseFloat((last - prev).toFixed(2))
  })()

  const oilForChart = (oilData?.data?.slice(-90) || []).map(d => ({
    timestamp: d.date + 'T12:00:00',
    price:     d.price_usd_bbl,
  }))

  const currentScenario = MODEL_SCENARIOS.find(s => s.value === scenario)
  const isNonDiesel = fuelType !== 'diesel' && (scenario === 'spedition' || scenario === 'b29')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="relative bg-brand-orange border-b-2 border-brand-charcoal/10 px-4 py-2 shrink-0 space-y-2 overflow-hidden">
        <PixelPattern color1="rgba(28,28,26,0.12)" color2="transparent" size={24} steps={4}
          className="absolute top-0 right-0 pointer-events-none" />
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-brand-charcoal/40">03</span>
            <h1 className="text-sm font-bold text-brand-charcoal uppercase tracking-wide">Analyse — Modell-Preis-Feld</h1>
          </div>

          {/* Fuel */}
          <div className="flex gap-1">
            {FUEL_TYPES.map(ft => (
              <button
                key={ft}
                onClick={() => setFuelType(ft)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  fuelType === ft ? 'bg-brand-charcoal text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
                }`}
              >
                {FUEL_LABELS[ft]}
              </button>
            ))}
          </div>

          {/* Scenario */}
          <div className="flex gap-1">
            {MODEL_SCENARIOS.map(s => (
              <button
                key={s.value}
                onClick={() => setScenario(s.value)}
                title={s.desc}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  scenario === s.value
                    ? 'bg-brand-charcoal text-white'
                    : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Warnings */}
          {isNonDiesel && (
            <span className="text-xs text-brand-charcoal bg-brand-yellow/60 border border-brand-yellow px-2 py-0.5">
              Modell nur für Diesel — E5/E10 als Näherung
            </span>
          )}
          {scenario === 'germany' && !geoData?.meta?.model_available && !loading && (
            <span className="text-xs text-brand-charcoal bg-brand-cyan/40 border border-brand-cyan px-2 py-0.5">
              all_germany_web_mlp.ipynb ausführen um Modell zu erzeugen
            </span>
          )}

          {/* Oil delta */}
          {oilDelta !== 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              oilDelta > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
              Öl {oilDelta > 0 ? '▲' : '▼'} {Math.abs(oilDelta)} USD/bbl
            </span>
          )}

          {geoData?.meta && (
            <span className="ml-auto text-xs text-gray-400">
              {geoData.meta.n_stations} Orte · {geoData.meta.date}
            </span>
          )}
          {error && <span className="ml-auto text-xs text-red-500">{error}</span>}

          <button
            onClick={() => setShowEli5(v => !v)}
            className="text-xs text-brand-charcoal font-semibold hover:text-brand-charcoal/60 shrink-0 transition-colors"
          >
            {showEli5 ? '▲ ELI5' : '▼ ELI5'}
          </button>
        </div>

        {showEli5 && currentScenario && (
          <Eli5 title={`Was zeigt das Modell hier? — ${currentScenario.label}`}>
            {currentScenario.eli5}
            {' '}Wähle <strong>Vektor-Modus</strong> in der Karte (Steuerfeld rechts):
            die Länge jedes Pfeils = vorhergesagter Preis, Farbe = günstig/teuer.
            Der <strong>Zeit-Slider</strong> bewegt dich durch die 72h-Prognose —
            das ist das gelernte Preismuster des Modells in Aktion.
          </Eli5>
        )}
      </div>

      {/* Two-panel: map (left) + oil context (right) */}
      <div className="flex-1 flex overflow-hidden">

        {/* 3D Map */}
        <div className="flex-1 relative overflow-hidden">
          <GeoPriceMap3D
            data={geoData}
            fuelType={fuelType}
            loading={loading}
            scenario={scenario}
          />
        </div>

        {/* Right panel: oil + model info */}
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-700 mb-0.5">Rohölpreis — Brent</h3>
            <p className="text-[10px] text-gray-400">
              Marktkontext für Modell-Vorhersagen
            </p>
          </div>

          <div className="flex-1 p-3 overflow-auto space-y-4">
            {oilForChart.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-bold ${oilDelta > 0 ? 'text-red-600' : oilDelta < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                    {oilDelta > 0 ? '+' : ''}{oilDelta !== 0 ? oilDelta : '–'} USD
                  </span>
                  <span className="text-xs text-gray-400">2-Tage-Änderung</span>
                </div>
                <div style={{ height: 140 }}>
                  <PriceLineChart datasets={[{ fuelType: 'diesel', data: oilForChart }]} />
                </div>
                <p className="text-[10px] text-gray-400">
                  Letzter Wert:{' '}
                  <span className="font-mono text-gray-600">
                    {oilData?.data?.slice(-1)[0]?.price_usd_bbl?.toFixed(2)} USD/bbl
                  </span>
                </p>
              </>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">
                <p className="mb-1">Keine Öl-Daten</p>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] block">
                  python scripts/fetch_oil_prices.py
                </code>
              </div>
            )}

            {/* Model info */}
            {geoData?.meta && (
              <div className="pt-3 border-t border-gray-100 space-y-1.5">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Modell-Info
                </h4>
                {[
                  { label: 'Szenario',   val: geoData.meta.scenario },
                  { label: 'Kraftstoff', val: geoData.meta.fuel_type?.toUpperCase() },
                  { label: 'Orte',       val: geoData.meta.n_stations },
                  { label: 'Schritte',   val: geoData.stations?.[0]?.prices?.length ?? '—' },
                  { label: 'Quelle',     val: geoData.meta.data_source || geoData.meta.model_source || '—' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-xs">
                    <span className="text-gray-400">{r.label}</span>
                    <span className="text-gray-700 font-medium truncate max-w-[120px]" title={String(r.val)}>
                      {r.val}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Eli5 title="Öl & Sprit">
              Etwa 40–60 % des Kraftstoffpreises sind Rohöl-Kosten.
              Ein Anstieg von 5 USD/bbl macht sich am Zapfhahn in 2–4 Wochen bemerkbar.
              Unser Modell lernt diese Muster implizit aus den Preisverläufen.
            </Eli5>

            {/* Link to deeper analysis */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-[10px] text-gray-400 font-medium">Weiter erkunden</p>
              {[
                { href: '/modelle', label: '🧠 Modell-Story', desc: 'B29 → Spedition → All-Germany' },
                { href: '/deployment', label: '🚛 Deployment', desc: 'Live Dispatch-Empfehlung' },
                { href: '/karte', label: '🗺️ Geo-Exploration', desc: 'Alle 15k Stationen' },
              ].map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  className="block text-xs text-brand-orange hover:text-brand-orange/70 leading-tight transition-colors"
                >
                  {l.label}
                  <span className="block text-[10px] text-gray-400">{l.desc}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
