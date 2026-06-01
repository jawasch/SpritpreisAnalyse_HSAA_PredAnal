import { useState, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { api } from '../../services/api'
import { formatPrice } from '../../utils/format'

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}`)
const HEAT_COLORS = ['#16a34a', '#22c55e', '#fde68a', '#f59e0b', '#ef4444']
const WEEKS = [2, 4, 8]

/** One ECharts heatmap. yLabels bottom→top (index 0 at bottom). */
function useHeatmap(ref, opt, deps) {
  const chartRef = useRef(null)
  useEffect(() => {
    if (!ref.current || !opt) return
    if (!chartRef.current) chartRef.current = echarts.init(ref.current)
    chartRef.current.setOption(opt, { notMerge: true })
    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null }, []) // eslint-disable-line
}

function heatmapOption({ data, yLabels, min, max, yName, tooltipDate, inverseY }) {
  return {
    animation: false,
    grid: { left: 64, right: 16, top: 8, bottom: 56 },
    tooltip: {
      position: 'top',
      formatter: p => {
        const [x, y, v] = p.value
        const lbl = tooltipDate
          ? new Date(yLabels[y]).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
          : yLabels[y]
        return `${lbl} · ${HOURS[x]}:00<br/><b>${formatPrice(v)} €/L</b>`
      },
    },
    xAxis: {
      type: 'category', data: HOURS, name: 'Uhrzeit', nameLocation: 'middle', nameGap: 28,
      nameTextStyle: { fontSize: 10, color: '#94a3b8' },
      axisLabel: { fontSize: 9, interval: 1 }, splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: tooltipDate
        ? yLabels.map(d => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }))
        : yLabels,
      name: yName, inverse: inverseY,
      axisLabel: { fontSize: 9 }, splitArea: { show: true },
    },
    visualMap: {
      min, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 80,
      inRange: { color: HEAT_COLORS }, text: ['teuer', 'günstig'], textStyle: { fontSize: 10 },
      precision: 2, formatter: v => formatPrice(v, 2),
    },
    series: [{
      type: 'heatmap', data,
      emphasis: { itemStyle: { borderColor: '#1c1c1a', borderWidth: 1 } },
      progressive: 0,
    }],
  }
}

export default function PriceHeatmaps() {
  const allRef = useRef(null)
  const recRef = useRef(null)
  const [weeks, setWeeks] = useState(4)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.analytics.priceHeatmaps(weeks)
      .then(r => { setPayload(r?.ok ? r : null); setLoading(false) })
      .catch(() => { setPayload(null); setLoading(false) })
  }, [weeks])

  const wh = payload?.weekday_hour
  const rc = payload?.recent

  useHeatmap(allRef, wh && heatmapOption({
    data: wh.data, yLabels: wh.weekdays, min: wh.min, max: wh.max,
    yName: '', tooltipDate: false, inverseY: true,   // Mo at top
  }), [wh])

  useHeatmap(recRef, rc && heatmapOption({
    data: rc.data, yLabels: rc.dates, min: rc.min, max: rc.max,
    yName: '', tooltipDate: true, inverseY: false,   // newest at top
  }), [rc])

  const Btn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        active ? 'bg-brand-orange text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
      }`}>{children}</button>
  )

  return (
    <div className="space-y-6">
      {/* All-years averaged weekday × hour */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Gemittelt über alle Jahre — Wochentag × Uhrzeit</h3>
        <p className="text-xs text-gray-400 mb-2">
          Ø Dieselpreis je Wochentag und Stunde über die gesamte Historie (2014–heute).
          {wh && <> Ø gesamt: <span className="font-mono">{formatPrice(wh.overall_avg)} €/L</span>.</>}
        </p>
        <div className="relative">
          <div ref={allRef} style={{ height: 240 }} className="w-full" />
          {loading && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white/60">Lade …</div>}
        </div>
      </div>

      {/* Live last N weeks */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-700">Live — die letzten Wochen, Tag × Uhrzeit</h3>
          <div className="flex items-center gap-1">
            {WEEKS.map(w => <Btn key={w} active={weeks === w} onClick={() => setWeeks(w)}>{w} Wochen</Btn>)}
          </div>
          {rc && <span className="text-[11px] text-gray-400">{rc.start} – {rc.end}</span>}
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Tatsächliche Stundenpreise der letzten {weeks} Wochen (jüngster Tag oben) — direkt aus den Daten.
        </p>
        <div className="relative">
          <div ref={recRef} style={{ height: Math.max(220, (rc?.dates?.length || 28) * 13 + 70) }} className="w-full" />
          {loading && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white/60">Lade …</div>}
        </div>
      </div>
    </div>
  )
}
