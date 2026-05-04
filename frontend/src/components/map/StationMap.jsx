import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FUEL_COLORS, FUEL_LABELS } from '../../services/api'

// Fix Leaflet default icon paths broken by Vite bundling
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
      width:12px;height:12px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { duration: 1 })
  }, [center, map])
  return null
}

export default function StationMap({ stations, fuelType = 'e5', center, radius }) {
  const prices = stations
    .map((s) => s[fuelType])
    .filter((p) => p && p !== false)

  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)

  return (
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
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1.5 }}
        />
      )}

      {stations.map((s) => {
        const price = s[fuelType]
        const color = priceColor(price, minP, maxP)
        return (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={makeIcon(color)}>
            <Popup>
              <div className="text-xs leading-relaxed min-w-[160px]">
                <p className="font-semibold text-sm text-gray-800">{s.name}</p>
                <p className="text-gray-500 mb-2">
                  {s.street} {s.houseNumber}, {s.postCode} {s.place}
                </p>
                <table className="w-full">
                  {['e5', 'e10', 'diesel'].map((ft) => (
                    <tr key={ft}>
                      <td className="pr-3 text-gray-500">{FUEL_LABELS[ft]}</td>
                      <td
                        className="font-mono font-semibold text-right"
                        style={{ color: FUEL_COLORS[ft] }}
                      >
                        {s[ft] && s[ft] !== false ? `${s[ft].toFixed(3)} €` : '–'}
                      </td>
                    </tr>
                  ))}
                </table>
                <p className="mt-2 text-gray-400">{s.dist} km entfernt</p>
                <p
                  className="mt-1 font-medium"
                  style={{ color: s.isOpen ? '#22c55e' : '#ef4444' }}
                >
                  {s.isOpen ? '● Geöffnet' : '● Geschlossen'}
                </p>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {center && <FlyTo center={center} />}
    </MapContainer>
  )
}
