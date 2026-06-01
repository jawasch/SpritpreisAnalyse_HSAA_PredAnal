import { useState, useEffect } from 'react'
import { api } from '../../../services/api'

/** Colour ramp shared by both bar charts: green (cheap) → amber → red (expensive). */
function barColor(t) {
  return t < 0.4 ? '#22c55e' : t < 0.7 ? '#f59e0b' : '#ef4444'
}

function IntradayBars({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div>
      <div className="flex items-end gap-0.5 h-40">
        {data.map(d => {
          const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
          return (
            <div key={d.hour} className="flex-1 rounded-t"
              style={{ height: `${Math.max(8, t * 100)}%`, background: barColor(t), opacity: 0.85 }}
              title={`${d.hour}:00 — ${d.avg_price.toFixed(4)} €/L`} />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
    </div>
  )
}

function WeekdayBars({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div className="flex gap-2 items-end h-40">
      {data.map(d => {
        const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
        return (
          <div key={d.dow} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
            <div className="w-full rounded-t"
              style={{ height: `${Math.max(12, t * 100)}%`, background: barColor(t), opacity: 0.85 }}
              title={`${d.label}: ${d.avg_price.toFixed(4)} €/L`} />
            <span className="text-xs text-gray-500">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Live EDA trends for the deck: hourly intraday profile + weekday pattern, pulled
 * from the recorded EDA summary. Lets the presentation explore the real temporal
 * structure interactively (hover for exact prices) instead of a static image.
 */
export default function ExplorationTrendsEmbed() {
  const [eda,   setEda]   = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.eda.summary().then(setEda).catch(e => setError(String(e)))
  }, [])

  if (error) return <div className="text-sm text-red-500">EDA-Summary nicht verfügbar: {error}</div>

  return (
    <div className="flex-1 grid md:grid-cols-2 gap-6 min-h-0">
      <div className="bg-white border border-gray-200 shadow-sm rounded p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Intraday-Profil — Preis je Stunde</h3>
        <p className="text-xs text-gray-400 mb-4">Morgens teuer, abends/nachts günstig</p>
        <div className="flex-1 flex items-end"><IntradayBars data={eda?.intraday_profile} /></div>
      </div>
      <div className="bg-white border border-gray-200 shadow-sm rounded p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Wochentags-Muster</h3>
        <p className="text-xs text-gray-400 mb-4">Ø Dieselpreis je Wochentag</p>
        <div className="flex-1 flex items-end"><WeekdayBars data={eda?.weekday_pattern} /></div>
      </div>
    </div>
  )
}
