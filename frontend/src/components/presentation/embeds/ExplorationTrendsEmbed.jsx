import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import IntradayByRegionChart from '../../charts/IntradayByRegionChart'

/** Colour ramp shared by both bar charts: green (cheap) → amber → red (expensive). */
function barColor(t) {
  return t < 0.4 ? '#22c55e' : t < 0.7 ? '#f59e0b' : '#ef4444'
}

function IntradayBars({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex items-end gap-0.5 min-h-0">
        {data.map(d => {
          const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
          return (
            <div key={d.hour} className="flex-1 rounded-t"
              style={{ height: `${Math.max(6, t * 100)}%`, background: barColor(t), opacity: 0.85 }}
              title={`${d.hour}:00 — ${d.avg_price.toFixed(4)} €/L`} />
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 mt-1 shrink-0">
        <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  )
}

function WeekdayBars({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div className="flex-1 flex gap-2 items-end min-h-0">
      {data.map(d => {
        const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
        return (
          <div key={d.dow} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
            <div className="w-full rounded-t"
              style={{ height: `${Math.max(8, t * 100)}%`, background: barColor(t), opacity: 0.85 }}
              title={`${d.label}: ${d.avg_price.toFixed(4)} €/L`} />
            <span className="text-[11px] text-gray-500 shrink-0">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ title, sub, children }) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded p-4 flex flex-col min-h-0">
      <h3 className="text-sm font-semibold text-gray-700 shrink-0">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mb-2 shrink-0">{sub}</p>}
      {children}
    </div>
  )
}

/**
 * Live EDA trends for the deck — fills its 16:9 frame: the per-region intraday
 * profile (5 routes) on top, plus aggregate intraday + weekday pattern below.
 * All pulled live from the backend (EDA summary + intraday-by-region).
 */
export default function ExplorationTrendsEmbed() {
  const [eda,    setEda]    = useState(null)
  const [region, setRegion] = useState(null)
  const [error,  setError]  = useState(null)

  useEffect(() => {
    api.eda.summary().then(setEda).catch(e => setError(String(e)))
    api.eda.intradayByRegion().then(setRegion).catch(() => {})
  }, [])

  if (error) return <div className="text-sm text-red-500">EDA-Summary nicht verfügbar: {error}</div>

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <Panel title="Intraday-Profil — Mittlerer Dieselpreis je Stunde und Region"
        sub="5 Routen · live · Maus für Stundenwerte">
        <div className="flex-1 min-h-0"><IntradayByRegionChart data={region} /></div>
      </Panel>
      <div className="grid md:grid-cols-2 gap-4 shrink-0" style={{ height: '32%' }}>
        <Panel title="Aggregiertes Intraday" sub="Ø über alle Stationen">
          <IntradayBars data={eda?.intraday_profile} />
        </Panel>
        <Panel title="Wochentags-Muster" sub="Ø Dieselpreis je Wochentag">
          <WeekdayBars data={eda?.weekday_pattern} />
        </Panel>
      </div>
    </div>
  )
}
