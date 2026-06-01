import { useState, useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { api } from '../../services/api'
import { formatPrice } from '../../utils/format'

const RESOLUTIONS = [
  { value: 'day',   label: 'Tag' },
  { value: 'week',  label: 'Woche' },
  { value: 'month', label: 'Monat' },
]
const SMOOTHING = [
  { value: 0,  label: 'Keine' },
  { value: 7,  label: 'Kurz' },
  { value: 30, label: 'Lang' },
]
const RANGES = [
  { value: 0,    label: 'Alles' },
  { value: 1095, label: '3 Jahre' },
  { value: 365,  label: '1 Jahr' },
]

/** Trailing moving average over `w` points (per series). */
function movingAvg(data, w) {
  if (!w || w < 2) return data
  const out = []
  let sum = 0
  const q = []
  for (const [t, v] of data) {
    q.push(v); sum += v
    if (q.length > w) sum -= q.shift()
    out.push([t, +(sum / q.length).toFixed(3)])
  }
  return out
}

export default function LongTermPriceChart() {
  const elRef   = useRef(null)
  const chartRef = useRef(null)
  const [resolution, setResolution] = useState('week')
  const [smooth, setSmooth] = useState(0)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)   // { lo, hi, min, max, avg, spread }

  // Fetch series when resolution changes
  useEffect(() => {
    setLoading(true)
    api.prices.longterm(resolution)
      .then(r => { setPayload(r?.ok ? r : null); setLoading(false) })
      .catch(() => { setPayload(null); setLoading(false) })
  }, [resolution])

  // Compute stats of the 'avg' series within the currently visible x-range
  const recomputeStats = useCallback(() => {
    const chart = chartRef.current
    if (!chart || !payload) return
    let lo = -Infinity, hi = Infinity
    try {
      const ext = chart.getModel().getComponent('xAxis', 0).axis.scale.getExtent()
      lo = ext[0]; hi = ext[1]
    } catch { /* keep full range */ }
    const avg = payload.series.find(s => s.key === 'avg')
    if (!avg) return
    const vis = avg.data.filter(([t]) => t >= lo && t <= hi).map(([, v]) => v)
    if (!vis.length) { setStats(null); return }
    const min = Math.min(...vis), max = Math.max(...vis)
    setStats({
      lo, hi, min, max,
      avg: vis.reduce((a, b) => a + b, 0) / vis.length,
      spread: max - min,
    })
  }, [payload])

  // (Re)build the chart whenever data or smoothing changes
  useEffect(() => {
    if (!elRef.current || !payload) return
    if (!chartRef.current) chartRef.current = echarts.init(elRef.current)
    const chart = chartRef.current

    const series = payload.series.map(s => ({
      name: s.label,
      type: 'line',
      showSymbol: false,
      sampling: 'lttb',
      smooth: false,
      lineStyle: { width: s.key === 'avg' ? 2.6 : 1.1, color: s.color, type: s.key === 'avg' ? 'solid' : 'solid' },
      itemStyle: { color: s.color },
      emphasis: { focus: 'series' },
      z: s.key === 'avg' ? 5 : 2,
      data: smooth ? movingAvg(s.data, smooth) : s.data,
    }))

    chart.setOption({
      animation: false,
      color: payload.series.map(s => s.color),
      grid: { left: 52, right: 18, top: 40, bottom: 78 },
      legend: { top: 4, type: 'scroll', textStyle: { fontSize: 11 }, inactiveColor: '#cbd5e1' },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross' },
        valueFormatter: v => (v == null ? '–' : `${formatPrice(v)} €/L`),
      },
      xAxis: { type: 'time', boundaryGap: false },
      yAxis: {
        type: 'value', scale: true, name: '€/L', nameTextStyle: { fontSize: 10, color: '#94a3b8' },
        axisLabel: { formatter: v => formatPrice(v, 2) }, splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      dataZoom: [
        { type: 'inside', filterMode: 'none' },
        { type: 'slider', height: 26, bottom: 30, borderColor: 'transparent',
          fillerColor: 'rgba(245,158,11,0.18)', handleStyle: { color: '#f59e0b' } },
      ],
      toolbox: {
        right: 8, top: 2, itemSize: 14,
        feature: {
          dataZoom: { yAxisIndex: false, title: { zoom: 'Bereich zoomen', back: 'Zurück' } },
          restore: { title: 'Zurücksetzen' },
          saveAsImage: { title: 'PNG', name: 'langzeit-preisverlauf' },
        },
      },
      series,
    }, { notMerge: true })

    chart.off('datazoom')
    chart.on('datazoom', recomputeStats)
    recomputeStats()
    return undefined
  }, [payload, smooth, recomputeStats])

  // Resize handling + cleanup
  useEffect(() => {
    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  // Quick time-range presets → drive dataZoom by start/end value
  const applyRange = (days) => {
    const chart = chartRef.current
    if (!chart || !payload) return
    const avg = payload.series.find(s => s.key === 'avg')
    const last = avg?.data?.[avg.data.length - 1]?.[0]
    if (!last) return
    if (!days) {
      chart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
    } else {
      const startValue = last - days * 24 * 3600 * 1000
      chart.dispatchAction({ type: 'dataZoom', startValue, endValue: last })
    }
    setTimeout(recomputeStats, 50)
  }

  const Btn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        active ? 'bg-brand-orange text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
      }`}>
      {children}
    </button>
  )

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Auflösung</span>
          {RESOLUTIONS.map(r => (
            <Btn key={r.value} active={resolution === r.value} onClick={() => setResolution(r.value)}>{r.label}</Btn>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Glättung</span>
          {SMOOTHING.map(s => (
            <Btn key={s.value} active={smooth === s.value} onClick={() => setSmooth(s.value)}>{s.label}</Btn>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Zeitfenster</span>
          {RANGES.map(r => (
            <Btn key={r.value} active={false} onClick={() => applyRange(r.value)}>{r.label}</Btn>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div ref={elRef} style={{ height: 360 }} className="w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white/60">
            Lade Langzeitdaten …
          </div>
        )}
      </div>

      {/* Range stats */}
      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-500">
          <span>Ausschnitt: <span className="font-mono text-gray-700">
            {new Date(stats.lo).toLocaleDateString('de-DE')} – {new Date(stats.hi).toLocaleDateString('de-DE')}</span></span>
          <span>Ø <span className="font-mono text-brand-orange">{formatPrice(stats.avg)} €/L</span></span>
          <span>Min <span className="font-mono text-green-600">{formatPrice(stats.min)}</span></span>
          <span>Max <span className="font-mono text-red-600">{formatPrice(stats.max)}</span></span>
          <span>Spanne <span className="font-mono text-gray-700">{formatPrice(stats.spread)} €/L</span></span>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">
        Ziehen zum Verschieben · Mausrad/Box zum Zoomen · Legende klicken, um Stationen ein-/auszublenden ·
        5 Speditions-Stationen + Durchschnitt, 2014–heute.
      </p>
    </div>
  )
}
