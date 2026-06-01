import { useState, useEffect, useRef, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { ColumnLayer, ScatterplotLayer, PathLayer, TextLayer, LineLayer, IconLayer } from '@deck.gl/layers'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: 9.8,
  latitude:  48.7,
  zoom:      7,
  pitch:     50,
  bearing:   -10,
  transitionDuration: 300,
}

function priceToColor(price, min, max, alpha = 200) {
  const t = Math.max(0, Math.min(1, (price - min) / (max - min || 1)))
  if (t < 0.5) return [Math.round(255 * t * 2), 210, 0, alpha]
  return [255, Math.round(210 * (1 - (t - 0.5) * 2)), 0, alpha]
}

const AALEN = [10.0931, 48.8375]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

const COLUMN_RADIUS = { all: 400, spedition: 1500, b29: 6000, germany: 25000 }

// Meter-length of vector shaft proportional to price
function priceToHeight(price, min, max) {
  return Math.max(50, (price - min) / (max - min || 1) * 80000)
}

export default function GeoPriceMap3D({ data, fuelType = 'diesel', loading = false, scenario = 'all' }) {
  const [hourIndex, setHourIndex] = useState(12)
  const [playing, setPlaying]     = useState(false)
  const [renderMode, setRenderMode] = useState('vector') // 'vector' | 'column' | '2d'
  const [colorMode, setColorMode]   = useState('abs')
  const [hoverInfo, setHoverInfo]   = useState(null)
  const playRef = useRef(null)

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setHourIndex(h => (h + 1) % (data?.stations?.[0]?.prices?.length || 24))
      }, 600)
    }
    return () => clearInterval(playRef.current)
  }, [playing, data])

  const stationsAtHour = useCallback(() => {
    if (!data?.stations) return []
    return data.stations
      .map(s => ({
        id:        s.id,
        name:      s.name,
        brand:     s.brand,
        position:  [s.lng, s.lat],
        price:     s.prices?.[hourIndex]?.price ?? null,
        timestamp: s.prices?.[hourIndex]?.timestamp ?? '',
        color:     s.color,
      }))
      .filter(s => s.price !== null)
  }, [data, hourIndex])

  const stations = stationsAtHour()
  const prices   = stations.map(s => s.price)
  const priceMin = prices.length ? Math.min(...prices) : 1.5
  const priceMax = prices.length ? Math.max(...prices) : 1.9
  const priceMean = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 1.7

  const getColor = (s, alpha = 200) => {
    const val = colorMode === 'dev' ? s.price - priceMean + priceMean : s.price
    const lo  = colorMode === 'dev' ? priceMean - 0.05 : priceMin
    const hi  = colorMode === 'dev' ? priceMean + 0.05 : priceMax
    return priceToColor(val, lo, hi, alpha)
  }

  const colRadius = COLUMN_RADIUS[scenario] ?? 600

  // ── Spedition route arrows ───────────────────────────────────────────────────
  const routeArrows = scenario === 'spedition' && stations.length > 0
    ? stations.map(s => ({
        path:  [AALEN, s.position],
        name:  s.name,
        color: s.color ? hexToRgb(s.color) : [99, 102, 241],
      }))
    : []

  // ── Vector arrow layers (shaft = LineLayer, tip = ColumnLayer) ───────────────
  const vectorShaftLayer = renderMode === 'vector'
    ? new LineLayer({
        id:   'vector-shafts',
        data: stations,
        getSourcePosition: s => [...s.position, 0],
        getTargetPosition: s => [
          s.position[0],
          s.position[1],
          priceToHeight(s.price, priceMin, priceMax),
        ],
        getColor:  s => getColor(s, 220),
        getWidth:  renderMode === 'vector' ? (scenario === 'all' ? 1 : 4) : 0,
        widthUnits: 'pixels',
        pickable: true,
        onHover: info => setHoverInfo(info.object ? info : null),
      })
    : null

  const vectorTipLayer = renderMode === 'vector'
    ? new ColumnLayer({
        id:   'vector-tips',
        data: stations,
        getPosition: s => s.position,
        getElevation: s => priceToHeight(s.price, priceMin, priceMax),
        getFillColor: s => getColor(s, 255),
        radius:    colRadius * 0.4,
        diskResolution: 12,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        onHover: info => setHoverInfo(info.object ? info : null),
      })
    : null

  // ── Classic column layer ─────────────────────────────────────────────────────
  const columnLayer = renderMode === 'column'
    ? new ColumnLayer({
        id:   'price-columns',
        data: stations,
        getPosition:  s => s.position,
        getElevation: s => Math.max(0, (s.price - priceMin) * 80000),
        getFillColor: s => getColor(s),
        radius:    colRadius,
        pickable:  true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        onHover: info => setHoverInfo(info.object ? info : null),
      })
    : null

  // ── 2D Scatterplot ───────────────────────────────────────────────────────────
  const scatterLayer = renderMode === '2d'
    ? new ScatterplotLayer({
        id:   'price-dots',
        data: stations,
        getPosition: s => s.position,
        getRadius:   colRadius * 1.3,
        getFillColor: s => getColor(s),
        pickable: true,
        onHover: info => setHoverInfo(info.object ? info : null),
      })
    : null

  // ── Spedition route lines ────────────────────────────────────────────────────
  const pathLayer = routeArrows.length > 0
    ? new PathLayer({
        id:   'route-arrows',
        data: routeArrows,
        getPath:  d => d.path,
        getColor: d => [...d.color, 160],
        getWidth: 3000,
        widthUnits: 'meters',
        pickable: false,
      })
    : null

  // ── Labels ───────────────────────────────────────────────────────────────────
  const labelLayer = (scenario === 'b29' || scenario === 'spedition') && stations.length > 0
    ? new TextLayer({
        id:   'station-labels',
        data: stations,
        getPosition:   s => s.position,
        getText:       s => s.name,
        getSize:       scenario === 'b29' ? 18 : 14,
        getColor:      [255, 255, 255, 220],
        getPixelOffset: [0, -20],
        fontWeight:    'bold',
        pickable:      false,
      })
    : null

  const layers = [
    vectorShaftLayer, vectorTipLayer,
    columnLayer, scatterLayer,
    pathLayer, labelLayer,
  ].filter(Boolean)

  const currentTimestamp = data?.stations?.[0]?.prices?.[hourIndex]?.timestamp ?? ''
  const formattedTime = currentTimestamp
    ? new Date(currentTimestamp).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : `${String(hourIndex).padStart(2, '0')}:00`
  const formattedDate = currentTimestamp
    ? new Date(currentTimestamp).toLocaleDateString('de-DE')
    : data?.meta?.date ?? '—'
  const nSteps = data?.stations?.[0]?.prices?.length ?? 24

  return (
    <div className="relative w-full h-full">
      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller={{ dragPan: true, scrollZoom: true, touchZoom: true }}
        layers={layers}
        getCursor={({ isDragging }) => isDragging ? 'grabbing' : 'grab'}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm">
            Lade Geo-Daten …
          </div>
        </div>
      )}

      {/* Control panel */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 text-white w-64 space-y-3 shadow-xl border border-gray-700">
        <h3 className="font-semibold text-sm text-gray-200">Geo-Exploration</h3>

        <div className="text-xs text-gray-400">
          <span className="text-white font-medium">{formattedDate}</span>{' '}
          <span className="text-blue-400 font-bold text-sm">{formattedTime}</span>
        </div>

        {/* Time slider */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Zeitpunkt ({hourIndex + 1}/{nSteps})
          </label>
          <input
            type="range" min={0} max={nSteps - 1} value={hourIndex}
            onChange={e => { setPlaying(false); setHourIndex(+e.target.value) }}
            className="w-full accent-blue-500"
          />
        </div>

        <button
          onClick={() => setPlaying(p => !p)}
          className="w-full py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          {playing ? '⏸ Pause' : '▶ Abspielen'}
        </button>

        {/* Render mode: Vector / Column / 2D */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Darstellung</p>
          <div className="flex gap-1 text-xs">
            {[
              { value: 'vector', label: 'Vektor' },
              { value: 'column', label: 'Säule' },
              { value: '2d',    label: '2D' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => setRenderMode(m.value)}
                className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
                  renderMode === m.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color mode */}
        <div className="flex gap-2 text-xs">
          {[
            { value: 'abs', label: 'Absolut' },
            { value: 'dev', label: 'Abweichung' },
          ].map(m => (
            <button
              key={m.value}
              onClick={() => setColorMode(m.value)}
              className={`flex-1 py-1 rounded-lg font-medium transition-colors ${
                colorMode === m.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Color legend */}
        <div>
          <div className="h-2 rounded-full"
            style={{ background: 'linear-gradient(to right, #00d200, #ffd200, #ff0000)' }} />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>{colorMode === 'abs' ? priceMin.toFixed(3) : '–0.05'} €/L</span>
            <span>{colorMode === 'abs' ? priceMax.toFixed(3) : '+0.05'} €/L</span>
          </div>
        </div>

        {/* Stats */}
        {stations.length > 0 && (
          <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-700 pt-2">
            <div>Szenario: <span className="text-indigo-400 uppercase">{scenario}</span></div>
            <div>Stationen: <span className="text-white">{stations.length.toLocaleString('de-DE')}</span></div>
            <div>Ø Preis: <span className="text-white">{priceMean.toFixed(3)} €/L</span></div>
            <div>Spread: <span className="text-amber-400">{((priceMax - priceMin) * 100).toFixed(1)} ct/L</span></div>
          </div>
        )}

        {renderMode === 'vector' && (
          <p className="text-[10px] text-gray-600 border-t border-gray-800 pt-2">
            Vektorlänge ∝ Preis · Grün = günstig · Rot = teuer
          </p>
        )}
      </div>

      {/* Hover tooltip */}
      {hoverInfo?.object && (
        <div
          className="absolute z-20 bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none border border-gray-700"
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y - 40 }}
        >
          <div className="font-medium text-sm">{hoverInfo.object.name}</div>
          <div className="text-gray-400">{hoverInfo.object.brand}</div>
          <div className="text-amber-400 font-bold mt-0.5">
            {hoverInfo.object.price?.toFixed(3)} €/L
          </div>
          <div className="text-gray-500 mt-0.5">{formattedDate} {formattedTime}</div>
        </div>
      )}
    </div>
  )
}
