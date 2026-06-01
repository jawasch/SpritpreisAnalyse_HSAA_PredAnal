import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import PixelPattern from '../components/ui/PixelPattern'

const ARBEITSTAGE = 250

function MetricChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-brand-charcoal text-white px-2.5 py-0.5 font-medium">
      <span className="text-brand-cyan">{label}</span>
      {value}
    </span>
  )
}

function SavingsBadge({ text }) {
  return (
    <span className="inline-flex items-center text-xs bg-green-100 text-green-800 rounded-full px-3 py-1 font-semibold">
      {text}
    </span>
  )
}

function FlottenKalkulator({ defaultTrucks = 25, defaultDailyLiters = 150, savingsPerLiter = 0.02 }) {
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
            { label: 'Ersparnis je LKW/Tag', val: `€ ${savingsPerTruckDay.toFixed(2)}`, bg: 'bg-gray-50' },
            { label: `Pro Tag (${numTrucks} Fahrzeuge)`, val: `€ ${savingsPerDay.toFixed(2)}`, bg: 'bg-green-50 border border-green-100' },
            { label: `Hochrechnung pro Jahr (${ARBEITSTAGE} Tage)`, val: `€ ${savingsPerYear.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`, bg: 'bg-green-100 border border-green-200 font-bold' },
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

function DispatchTable({ recs }) {
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
                <td className="py-2.5 text-right font-mono text-gray-700">{r.current_price.toFixed(3)}</td>
                <td className={`py-2.5 text-right font-mono font-semibold ${isCheapest ? 'text-green-700' : 'text-gray-800'}`}>
                  {r.predicted_best_price.toFixed(3)}
                </td>
                <td className="py-2.5 text-right text-gray-500 text-xs">{r.optimal_time_label}</td>
                <td className="py-2.5 text-right text-green-600 font-mono text-xs">
                  {r.savings_vs_now > 0 ? `−${r.savings_vs_now.toFixed(4)}` : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Deployment() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    api.predictions.spedition()
      .then(setData)
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-orange">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 06 · CRISP-DM · Deployment</p>
        <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Deployment</h1>
        <p className="text-sm mt-2 text-brand-charcoal/60">
          Live-Inferenz aus dem trainierten joblib-Modell — kein Mock, echte Vorhersagen für die fünf Stationen.
        </p>
        <PixelPattern color1="rgba(28,28,26,0.12)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 overflow-auto p-6 bg-brand-cream/60">
        <div className="max-w-5xl mx-auto space-y-6">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              Fehler: {error}
            </div>
          )}

          {loading && (
            <div className="bg-white border border-gray-200 p-10 flex items-center justify-center text-brand-charcoal/40 text-sm">
              Lade Live-Prognosen …
            </div>
          )}

          {!loading && data && (
            <>
              {/* Model banner */}
              <div className="bg-brand-cyan/15 border border-brand-cyan/40 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-brand-charcoal">{data.model?.name}</span>
                  <span className="text-xs text-brand-charcoal/60 font-mono">{data.model?.architecture}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-0.5 font-semibold">Diesel</span>
                  {data.model?.mae && <MetricChip label="MAE" value={`${data.model.mae.toFixed(4)} €/L`} />}
                  {data.model?.r2  && <MetricChip label="R²"  value={data.model.r2.toFixed(3)} />}
                  {data.model?.pick_accuracy_t1 && (
                    <MetricChip label="Pick-Acc t+1h" value={`${(data.model.pick_accuracy_t1 * 100).toFixed(0)} %`} />
                  )}
                  {data.savings && <SavingsBadge text={`€ ${data.savings.per_day_eur?.toFixed(0)}/Tag · ${data.savings.trucks} Fzg.`} />}
                </div>
                {data.parquet_last && (
                  <p className="text-xs text-brand-charcoal/50 mt-1.5">
                    Datenstand: {data.parquet_last.slice(0, 10)}
                    {data.live_prices_used && ' · Live-Preise eingebunden'}
                    {data.inference_error && <span className="text-amber-600"> · Fallback aktiv</span>}
                  </p>
                )}
              </div>

              <Eli5 title="Live-Inferenz: So funktioniert das jetzt">
                Diese Seite ruft das echte joblib-Modell auf — keine vorberechneten Ergebnisse.
                Das Backend lädt die letzten 200 Stunden aus dem Speditions-Parquet,
                berechnet 101 Features, skaliert sie, lässt das MLP vorhersagen und
                kehrt die Skalierung um. Das dauert weniger als 1 Sekunde.
              </Eli5>

              <DispatchTable recs={data.recommendations} />

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">72h-Prognose — 5 Stationen</h3>
                  <p className="text-xs text-gray-400 mb-4">Diesel · Hover für Stundenpreise</p>
                  <MultiStationForecastChart stations={data.stations || []} />
                </div>
                <div className="bg-white border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
                  <p className="text-xs text-gray-400 mb-4">Test-Datensatz 2024+</p>
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

              <FlottenKalkulator defaultTrucks={25} defaultDailyLiters={150} savingsPerLiter={0.02} />

              {/* Modell speichern/laden + Ausblick */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Modell speichern und laden</h3>
                  <p className="text-xs text-gray-600">
                    Das fertig trainierte Modell, beide Scaler und die Spalteninformationen werden als
                    <code className="bg-gray-100 px-1 text-[11px]">.joblib</code>-Datei gespeichert. So
                    kann das Modell in Echtzeit neu geladen werden, ohne das Training zu wiederholen —
                    Voraussetzung für den produktiven Einsatz.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Ausblick: Dashboard &amp; News-Ticker</h3>
                  <p className="text-xs text-gray-600">
                    Diese React-Oberfläche ist bereits die Dispatch-Empfehlung als interaktives
                    Dashboard. Ein nächster Schritt wäre eine automatisierte Abfrage von
                    Nachrichtentickern und deren möglicher Einfluss auf den Ölpreis — und damit auf
                    den Kraftstoffpreis.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
