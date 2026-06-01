import { useState, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { api } from '../../services/api'
import { formatPrice, formatNumber } from '../../utils/format'

const RESOLUTIONS = [
  { value: 'month',   label: 'Monat' },
  { value: 'quarter', label: 'Quartal' },
  { value: 'week',    label: 'Woche' },
]
const BINS = [
  { value: 0.01, label: '1 ct' },
  { value: 0.02, label: '2 ct' },
  { value: 0.05, label: '5 ct' },
]

/**
 * Dot-matrix / cloud of the price distribution over time:
 * x = time bucket, y = price class, dot size + colour = number of observed hourly prices.
 */
export default function PriceDistributionCloud() {
  const elRef    = useRef(null)
  const chartRef = useRef(null)
  const [resolution, setResolution] = useState('month')
  const [bin, setBin] = useState(0.02)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.prices.distribution(resolution, bin)
      .then(r => { setPayload(r?.ok ? r : null); setLoading(false) })
      .catch(() => { setPayload(null); setLoading(false) })
  }, [resolution, bin])

  useEffect(() => {
    if (!elRef.current || !payload) return
    if (!chartRef.current) chartRef.current = echarts.init(elRef.current)
    const chart = chartRef.current
    const maxC = Math.max(1, payload.max_count)

    chart.setOption({
      animation: false,
      grid: { left: 54, right: 20, top: 16, bottom: 96 },
      tooltip: {
        trigger: 'item',
        formatter: pt => {
          const [t, price, count] = pt.value
          const d = new Date(t).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' })
          return `<b>${d}</b><br/>Preis ~ ${formatPrice(price)} €/L<br/>${formatNumber(count)} Einträge`
        },
      },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', scale: true, name: '€/L',
        nameTextStyle: { fontSize: 10, color: '#94a3b8' },
        axisLabel: { formatter: v => formatPrice(v, 2), fontSize: 10 },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      visualMap: {
        min: 1, max: maxC, dimension: 2, calculable: true,
        orient: 'horizontal', left: 'center', bottom: 4, itemHeight: 90,
        text: ['viele', 'wenige'], textStyle: { fontSize: 10 },
        inRange: { color: ['#fde68a', '#f59e0b', '#ef4444', '#7f1d1d'] },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, height: 20, bottom: 44,
          fillerColor: 'rgba(245,158,11,0.18)', handleStyle: { color: '#f59e0b' } },
      ],
      series: [{
        type: 'scatter',
        symbolSize: val => 4 + 20 * Math.sqrt(val[2] / maxC),
        itemStyle: { opacity: 0.78 },
        data: payload.points,
        emphasis: { itemStyle: { opacity: 1, borderColor: '#1c1c1a', borderWidth: 1 } },
      }],
    }, { notMerge: true })
    return undefined
  }, [payload])

  useEffect(() => {
    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Zeitraster</span>
          {RESOLUTIONS.map(r => (
            <Btn key={r.value} active={resolution === r.value} onClick={() => setResolution(r.value)}>{r.label}</Btn>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Preisraster</span>
          {BINS.map(b => (
            <Btn key={b.value} active={bin === b.value} onClick={() => setBin(b.value)}>{b.label}</Btn>
          ))}
        </div>
        {payload && (
          <span className="ml-auto text-[11px] text-gray-400">
            {formatNumber(payload.n_obs)} Beobachtungen · 5 Stationen
          </span>
        )}
      </div>

      <div className="relative">
        <div ref={elRef} style={{ height: 380 }} className="w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm bg-white/60">
            Lade Verteilung …
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 mt-2">
        Jeder Punkt = ein Zeit×Preis-Feld · Größe &amp; Farbe = Anzahl beobachteter Stundenpreise.
        Ziehen/Mausrad zum Zoomen über die Zeit. Die Wolke zeigt, wann sich die Preise auf welchem
        Niveau gehäuft haben (z. B. der Energiekrisen-Sprung 2022).
      </p>
    </div>
  )
}
