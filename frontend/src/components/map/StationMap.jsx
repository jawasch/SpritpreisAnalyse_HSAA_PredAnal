import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FUEL_COLORS, FUEL_LABELS } from '../../services/api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function priceColor(price, min, max) {
  if (!price || price === false) return '#9ca3af'
  const ratio = (price - min) / (max - min || 1)
  const r = Math.round(34 + ratio * (239 - 34))
  const g = Math.round(197 - ratio * (197 - 68))
  const b = Math.round(94 - ratio * (94 - 68))
  return `rgb(${r},${g},${b})`
}

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2.5px solid white;
      box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 0.8 })
  }, [center, map])
  return null
}

function FitBounds({ stations }) {
  const map = useMap()
  useEffect(() => {
    if (stations.length > 1) {
      const bounds = stations.map((s) => [s.lat, s.lng])
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
    }
  }, [stations, map])
  return null
}

function MapEvents({ onMoveEnd }) {
  useMapEvents({
    moveend: (e) => onMoveEnd(e.target.getCenter()),
  })
  return null
}

export default function StationMap({ stations, fuelType = 'e5', center, radius, onSearchHere }) {
  const prices = stations.map((s) => s[fuelType]).filter((p) => p && p !== false)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)

  const pendingRef = useRef(false)

  const handleMoveEnd = (newCenter) => {
    pendingRef.current = true
    if (onSearchHere) {
      // Expose the new center so parent can decide whether to show the "search here" button
      onSearchHere({ lat: newCenter.lat, lng: newCenter.lng, pending: true })
    }
  }

  return (
    <div className="relative h-full">
      <MapContainer
        center={center || [48.8375, 10.0931]}
        zoom={10}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {center && radius && (
          <Circle
            center={center}
            radius={radius * 1000}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.04, weight: 1.5 }}
          />
        )}

        {stations.map((s) => {
          const price = s[fuelType]
          const color = priceColor(price, minP, maxP)
          return (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={makeIcon(color)}>
              <Popup maxWidth={220}>
                <div className="text-xs leading-relaxed" style={{ minWidth: '180px' }}>
                  <p className="font-semibold text-sm text-gray-800 mb-0.5">{s.name}</p>
                  <p className="text-gray-500 mb-2">
                    {s.brand} · {s.place}
                  </p>
                  <table className="w-full">
                    <tbody>
                      {['e5', 'e10', 'diesel'].map((ft) => (
                        <tr key={ft}>
                          <td className="pr-3 text-gray-500 py-0.5">{FUEL_LABELS[ft]}</td>
                          <td
                            className="font-mono font-semibold text-right py-0.5"
                            style={{ color: ft === fuelType ? FUEL_COLORS[ft] : '#6b7280' }}
                          >
                            {s[ft] && s[ft] !== false ? `${s[ft].toFixed(3)} €` : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 flex items-center justify-between text-gray-400">
                    <span>{s.dist} km entfernt</span>
                    <span style={{ color: s.isOpen ? '#22c55e' : '#ef4444' }} className="font-medium">
                      {s.isOpen ? '● Offen' : '● Geschlossen'}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {center && <FlyTo center={center} />}
        {stations.length > 1 && <FitBounds stations={stations} />}
        {onSearchHere && <MapEvents onMoveEnd={handleMoveEnd} />}
      </MapContainer>
    </div>
  )
}
