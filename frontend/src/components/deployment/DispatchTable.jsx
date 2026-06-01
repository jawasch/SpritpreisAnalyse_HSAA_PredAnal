import { formatPrice } from '../../utils/format'

/**
 * Dispatch recommendation table — prioritised station list with the concrete
 * savings spread per truck tank. Extracted from the Deployment page so the
 * presentation embed can reuse it unchanged.
 */
export default function DispatchTable({ recs }) {
  if (!recs?.length) return null
  const cheapestId = recs[0]?.route || recs[0]?.cluster_id
  return (
    <div className="bg-white border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Dispatch-Empfehlung (Diesel, nächste 72h)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Station</th>
            <th className="text-right pb-2 font-medium">Akt. Preis</th>
            <th className="text-right pb-2 font-medium">Bester Preis</th>
            <th className="text-right pb-2 font-medium">Optimale Zeit</th>
            <th className="text-right pb-2 font-medium">Ersparnis/L</th>
          </tr>
        </thead>
        <tbody>
          {recs.map(r => {
            const id = r.route || r.cluster_id
            const isCheapest = id === cheapestId
            return (
              <tr key={id} className={`border-b border-gray-50 last:border-0 ${isCheapest ? 'bg-green-50' : ''}`}>
                <td className="py-2.5">
                  <span className={`font-semibold ${isCheapest ? 'text-green-800' : 'text-gray-800'}`}>
                    {r.station_name || r.cluster}
                  </span>
                  {isCheapest && (
                    <span className="ml-2 text-xs bg-green-200 text-green-800 rounded-full px-2 py-0.5 font-medium">
                      Günstigste
                    </span>
                  )}
                  {r.distance_km && (
                    <span className="ml-2 text-xs text-gray-400">{r.distance_km} km</span>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-700">{formatPrice(r.current_price)}</td>
                <td className={`py-2.5 text-right font-mono font-semibold ${isCheapest ? 'text-green-700' : 'text-gray-800'}`}>
                  {formatPrice(r.predicted_best_price)}
                </td>
                <td className="py-2.5 text-right text-gray-500 text-xs">{r.optimal_time_label}</td>
                <td className="py-2.5 text-right text-green-600 font-mono text-xs">
                  {r.savings_vs_now > 0 ? `−${formatPrice(r.savings_vs_now, 4)}` : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
