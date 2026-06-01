import { useState } from 'react'
import { formatEuro } from '../../utils/format'

export const ARBEITSTAGE = 250

/**
 * Interactive fleet-cost calculator — sliders for trucks & daily liters, live
 * savings projection. Extracted from the Deployment page so the presentation
 * embed can offer the same interactive model-usage feature.
 */
export default function FlottenKalkulator({ defaultTrucks = 25, defaultDailyLiters = 150, savingsPerLiter = 0.02 }) {
  const [numTrucks,   setNumTrucks]   = useState(defaultTrucks)
  const [dailyLiters, setDailyLiters] = useState(defaultDailyLiters)
  const savingsPerTruckDay = dailyLiters * savingsPerLiter
  const savingsPerDay      = numTrucks * savingsPerTruckDay
  const savingsPerYear     = savingsPerDay * ARBEITSTAGE

  return (
    <div className="bg-white border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Flottenkosten-Kalkulator</h3>
      <p className="text-xs text-gray-400 mb-4">
        Potenzielle Einsparung bei optimiertem Dispatch (Ø {(savingsPerLiter * 100).toFixed(1)} ct/L
        Modell-Vorteil · {ARBEITSTAGE} Arbeitstage/Jahr)
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Fahrzeuge: <span className="text-brand-orange font-semibold">{numTrucks}</span>
            </label>
            <input type="range" min="1" max="50" value={numTrucks}
              onChange={e => setNumTrucks(Number(e.target.value))}
              className="w-full accent-brand-orange"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1</span><span>50</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Tagesverbrauch je LKW: <span className="text-brand-orange font-semibold">{dailyLiters} L</span>
            </label>
            <input type="range" min="50" max="300" step="10" value={dailyLiters}
              onChange={e => setDailyLiters(Number(e.target.value))}
              className="w-full accent-brand-orange"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>50 L</span><span>300 L</span></div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Ersparnis je LKW/Tag', val: formatEuro(savingsPerTruckDay, 2, { symbolFirst: true }), bg: 'bg-gray-50' },
            { label: `Pro Tag (${numTrucks} Fahrzeuge)`, val: formatEuro(savingsPerDay, 2, { symbolFirst: true }), bg: 'bg-green-50 border border-green-100' },
            { label: `Hochrechnung pro Jahr (${ARBEITSTAGE} Tage)`, val: formatEuro(savingsPerYear, 0, { symbolFirst: true }), bg: 'bg-green-100 border border-green-200 font-bold' },
          ].map(c => (
            <div key={c.label} className={`rounded-lg p-3 ${c.bg}`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-xl font-bold text-green-700">{c.val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
