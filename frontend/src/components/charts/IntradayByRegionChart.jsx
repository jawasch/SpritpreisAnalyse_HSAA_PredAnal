import { useState } from 'react'

/**
 * "Intraday-Profil: Mittlerer Dieselpreis je Stunde und Region" (PDF S.11 /
 * spedition_mlp.ipynb plot_intraday_by_region). One line per route (E/N/NE/NW/SW),
 * x = hour of day 0–23, y = mean diesel price. Pure SVG, scales to its container.
 *
 * @param {{regions:{route,label,color,points:{hour,avg_price}[]}[]}} props.data
 */
export default function IntradayByRegionChart({ data }) {
  const [hover, setHover] = useState(null) // { hour, x }
  const regions = data?.regions || []
  if (!regions.length) return null

  const W = 900, H = 460
  const m = { t: 16, r: 16, b: 44, l: 56 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b

  const allP = regions.flatMap(r => r.points.map(p => p.avg_price))
  const yMin = Math.min(...allP), yMax = Math.max(...allP)
  const pad = (yMax - yMin) * 0.08 || 0.01
  const lo = yMin - pad, hi = yMax + pad

  const x = h => m.l + (h / 23) * pw
  const y = v => m.t + (1 - (v - lo) / (hi - lo)) * ph

  const yTicks = 5
  const ticks = Array.from({ length: yTicks }, (_, i) => lo + (i / (yTicks - 1)) * (hi - lo))
  const xTicks = [0, 3, 6, 9, 12, 15, 18, 21, 23]

  const linePath = pts =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.hour).toFixed(1)},${y(p.avg_price).toFixed(1)}`).join(' ')

  return (
    <div className="w-full h-full flex flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full flex-1 min-h-0"
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          const h = Math.round(Math.max(0, Math.min(23, ((px - m.l) / pw) * 23)))
          setHover({ hour: h })
        }}>
        {/* grid + y labels */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={m.l} y1={y(v)} x2={W - m.r} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" />
            <text x={m.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="12" className="fill-brand-charcoal/60">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map(h => (
          <text key={h} x={x(h)} y={H - m.b + 20} textAnchor="middle" fontSize="12" className="fill-brand-charcoal/60">{h}</text>
        ))}
        <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" fontSize="12" className="fill-brand-charcoal/70">
          Stunde des Tages (0 = Mitternacht, 12 = Mittag)
        </text>
        {/* hover guide */}
        {hover && <line x1={x(hover.hour)} y1={m.t} x2={x(hover.hour)} y2={m.t + ph} stroke="#1c1c1a" strokeOpacity="0.25" strokeWidth="1" />}
        {/* lines + hover dots */}
        {regions.map(r => (
          <g key={r.route}>
            <path d={linePath(r.points)} fill="none" stroke={r.color} strokeWidth="2.5" />
            {hover && r.points[hover.hour] && (
              <circle cx={x(hover.hour)} cy={y(r.points[hover.hour].avg_price)} r="4" fill={r.color} stroke="white" strokeWidth="1.5" />
            )}
          </g>
        ))}
      </svg>
      {/* legend / hover readout */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-2 shrink-0">
        {regions.map(r => (
          <span key={r.route} className="flex items-center gap-1.5 text-xs text-brand-charcoal/75">
            <span className="inline-block w-4 h-0.5" style={{ background: r.color }} />
            {r.label}
            {hover && r.points[hover.hour] && (
              <span className="font-mono text-brand-charcoal">· {r.points[hover.hour].avg_price.toFixed(3)} €</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
