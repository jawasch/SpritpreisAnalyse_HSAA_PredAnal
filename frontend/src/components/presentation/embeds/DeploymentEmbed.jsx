import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import { formatPrice, formatNumber, formatPct } from '../../../utils/format'
import DispatchTable from '../../deployment/DispatchTable'
import MultiStationForecastChart from '../../charts/MultiStationForecastChart'
import PickAccuracyChart from '../../charts/PickAccuracyChart'

/**
 * Live model deployment for the deck: calls the real joblib model via
 * /predictions/spedition and shows the dispatch recommendation, the 72h forecast
 * and the pick-accuracy curve — the interactive "switch to the website" moment.
 */
export default function DeploymentEmbed() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.predictions.spedition()
      .then(setData)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-brand-charcoal/40">Lade Live-Prognosen …</div>
  if (error)   return <div className="text-sm text-red-500">Fehler: {error}</div>
  if (!data)   return null

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Model banner */}
      <div className="bg-brand-cyan/15 border border-brand-cyan/40 px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-brand-charcoal">{data.model?.name}</span>
        <span className="text-xs text-brand-charcoal/60 font-mono">{data.model?.architecture}</span>
        {data.model?.mae && <span className="text-xs bg-brand-charcoal text-white px-2 py-0.5">MAE {formatPrice(data.model.mae, 4)} €/L</span>}
        {data.model?.r2  && <span className="text-xs bg-brand-charcoal text-white px-2 py-0.5">R² {formatNumber(data.model.r2, 3)}</span>}
        {data.model?.pick_accuracy_t1 && <span className="text-xs bg-brand-charcoal text-white px-2 py-0.5">Pick-Acc t+1h {formatPct(data.model.pick_accuracy_t1, 0)}</span>}
        {data.parquet_last && (
          <span className="ml-auto text-xs text-brand-charcoal/50">
            Datenstand {data.parquet_last.slice(0, 10)}{data.live_prices_used && ' · Live'}
          </span>
        )}
      </div>

      <DispatchTable recs={data.recommendations} />

      <div className="grid md:grid-cols-2 gap-4 min-h-0">
        <div className="bg-white border border-gray-200 p-4 shadow-sm rounded">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 5 Stationen</h3>
          <p className="text-xs text-gray-400 mb-3">Diesel · Hover für Stundenpreise</p>
          <MultiStationForecastChart stations={data.stations || []} />
        </div>
        <div className="bg-white border border-gray-200 p-4 shadow-sm rounded">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
          <p className="text-xs text-gray-400 mb-3">Test-Datensatz 2024+</p>
          <PickAccuracyChart
            data={data.pick_accuracy_by_horizon}
            yKey="accuracy"
            yLabel="Pick-Accuracy"
            referenceValue={0.20}
            referenceLabel="Zufall (20 %)"
            formatY={v => `${(v * 100).toFixed(0)} %`}
          />
        </div>
      </div>
    </div>
  )
}
