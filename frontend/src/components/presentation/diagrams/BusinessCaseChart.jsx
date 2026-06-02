/**
 * Business-case chart (PDF S.5): cumulative savings / extra cost over 30 days for
 * a 25-truck fleet (3 750 L/day) vs. a 1.70 €/L base price, at five price levels.
 */
const BASE = 1.70
const VOL = 3750          // L/day for the whole fleet
const DAYS = 30
const LINES = [
  { price: 1.60, color: '#1e3a8a', dash: false },
  { price: 1.65, color: '#3b82f6', dash: false },
  { price: 1.70, color: '#9ca3af', dash: true },
  { price: 1.75, color: '#f87171', dash: false },
  { price: 1.80, color: '#dc2626', dash: false },
]

export default function BusinessCaseChart() {
  const W = 820, H = 440
  const m = { t: 30, r: 30, b: 50, l: 70 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const yMax = 12000
  const x = d => m.l + (d / DAYS) * pw
  const y = v => m.t + (1 - (v + yMax) / (2 * yMax)) * ph
  const endVal = price => (BASE - price) * VOL * DAYS

  const yTicks = [-10000, -5000, 0, 5000, 10000]
  const xTicks = [0, 5, 10, 15, 20, 25, 30]

  return (
    <div className="w-full h-full flex flex-col">
      <p className="text-center text-sm font-semibold text-brand-charcoal mb-1 shrink-0">
        Kumulative Kostenabweichung über 30 Tage · 25 LKW · 3 750 L/Tag
      </p>
      <p className="text-center text-xs text-brand-charcoal/50 mb-2 shrink-0">(gegenüber Basispreis 1,70 €/L)</p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full flex-1 min-h-0">
        {/* grid + y ticks */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={m.l} y1={y(v)} x2={W - m.r} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" />
            <text x={m.l - 10} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" className="fill-brand-charcoal/60">{v.toLocaleString('de-DE')}</text>
          </g>
        ))}
        {/* zero line emphasis */}
        <line x1={m.l} y1={y(0)} x2={W - m.r} y2={y(0)} stroke="#1c1c1a" strokeWidth="1.5" />
        {/* x ticks */}
        {xTicks.map(d => (
          <text key={d} x={x(d)} y={H - m.b + 18} textAnchor="middle" fontSize="11" className="fill-brand-charcoal/60">{d}</text>
        ))}
        <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" fontSize="12" className="fill-brand-charcoal/70">Tage</text>
        {/* lines */}
        {LINES.map(l => (
          <line key={l.price} x1={x(0)} y1={y(0)} x2={x(DAYS)} y2={y(endVal(l.price))}
            stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash ? '6 5' : ''} />
        ))}
        {/* region labels */}
        <text x={x(8)} y={y(6500)} fontSize="12" fontStyle="italic" className="fill-blue-700/70">Einsparpotenzial</text>
        <text x={x(8)} y={y(-6500)} fontSize="12" fontStyle="italic" className="fill-red-600/70">Mehrkosten-Risiko</text>
        <text x={x(30) - 4} y={y(11250) - 6} textAnchor="end" fontSize="11" fontWeight="700" className="fill-blue-900">+11 250 € nach 30 Tagen</text>
        <text x={x(30) - 4} y={y(-11250) + 16} textAnchor="end" fontSize="11" fontWeight="700" className="fill-red-700">−11 250 € nach 30 Tagen</text>
      </svg>
      {/* legend */}
      <div className="flex justify-center gap-4 mt-1 shrink-0">
        {LINES.map(l => (
          <span key={l.price} className="flex items-center gap-1.5 text-xs text-brand-charcoal/70">
            <span className="inline-block w-5 h-0.5" style={{ background: l.color }} />
            {l.price.toFixed(2)} €/L
          </span>
        ))}
      </div>
    </div>
  )
}
