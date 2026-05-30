import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/layout/Header'
import PriceLineChart from '../components/charts/PriceLineChart'
import { api, FUEL_COLORS, FUEL_LABELS, DEFAULT_LAT, DEFAULT_LNG } from '../services/api'

function PriceCard({ fuelType, price, change }) {
  const up = change >= 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{FUEL_LABELS[fuelType]}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: up ? '#ef4444' : '#22c55e',
            background: up ? '#fef2f2' : '#f0fdf4',
          }}
        >
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(3)}
        </span>
      </div>
      <div className="text-3xl font-bold" style={{ color: FUEL_COLORS[fuelType] }}>
        {price ? price.toFixed(3) : '–'}
      </div>
      <div className="text-xs text-gray-400">EUR / Liter · Ø aller Stationen</div>
    </div>
  )
}

function MetricChip({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 font-medium">
      <span className="text-blue-500">{label}</span>
      {value}
    </span>
  )
}

function ScenarioCard({ title, subtitle, modelInfo, savings, tableHead, tableRows, linkTo }) {
  const cheapestIdx = tableRows.reduce(
    (best, r, i) => (r.price < tableRows[best].price ? i : best),
    0
  )
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{subtitle}</p>
        </div>
        <span className="shrink-0 text-xs bg-green-100 text-green-800 rounded-full px-2.5 py-1 font-semibold">
          {savings}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {modelInfo.map((m) => (
          <MetricChip key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            {tableHead.map((h) => (
              <th key={h} className={`pb-1.5 font-medium ${h === tableHead[0] ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((r, i) => (
            <tr key={r.label} className={`border-b border-gray-50 last:border-0 ${i === cheapestIdx ? 'bg-green-50' : ''}`}>
              <td className={`py-1.5 font-medium ${i === cheapestIdx ? 'text-green-800' : 'text-gray-700'}`}>
                {r.label}
                {i === cheapestIdx && (
                  <span className="ml-1.5 text-xs bg-green-200 text-green-800 rounded-full px-1.5 py-0.5">
                    günstigste
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right font-mono text-gray-600">{r.price.toFixed(3)}</td>
              <td className="py-1.5 text-right text-gray-500">{r.sub}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link
        to={linkTo}
        className="self-end text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        Dispatch-Plan ansehen →
      </Link>
    </div>
  )
}

function BestTimeCard({ data }) {
  if (!data) return null
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Beste Tankzeit</p>
          <p className="text-sm text-green-700 mt-1">{data.insight}</p>
          <p className="text-xs text-green-600 mt-2">
            Ersparnis bis zu{' '}
            <strong>{data.potential_savings_eur?.toFixed(3)} EUR/L</strong>{' '}
            ({data.potential_savings_percent?.toFixed(1)} %)
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [fuelType, setFuelType] = useState('e5')
  const [history, setHistory] = useState({})
  const [bestTime, setBestTime] = useState(null)
  const [nearbyStations, setNearbyStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [speditionData, setSpeditionData] = useState(null)
  const [b29Data, setB29Data] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.prices.history('e5', 30),
      api.prices.history('e10', 30),
      api.prices.history('diesel', 30),
      api.analytics.bestTime(fuelType),
      api.stations.nearby(DEFAULT_LAT, DEFAULT_LNG, 25),
      api.predictions.spedition(),
      api.predictions.b29(),
    ])
      .then(([h5, h10, hd, bt, stations, sp, b29]) => {
        setHistory({ e5: h5.data, e10: h10.data, diesel: hd.data })
        setBestTime(bt)
        setNearbyStations(stations.stations?.slice(0, 5) || [])
        setSpeditionData(sp)
        setB29Data(b29)
        setError(null)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [fuelType])

  const currentPrices = {
    e5: history.e5?.[history.e5.length - 1]?.price,
    e10: history.e10?.[history.e10.length - 1]?.price,
    diesel: history.diesel?.[history.diesel.length - 1]?.price,
  }
  const prevPrices = {
    e5: history.e5?.[history.e5.length - 2]?.price,
    e10: history.e10?.[history.e10.length - 2]?.price,
    diesel: history.diesel?.[history.diesel.length - 2]?.price,
  }

  const chartDatasets = Object.entries(history)
    .filter(([, data]) => data?.length > 0)
    .map(([ft, data]) => ({ fuelType: ft, data }))

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" fuelType={fuelType} onFuelTypeChange={setFuelType} />

      <div className="flex-1 overflow-auto p-6 space-y-6 bg-gray-50">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Fehler beim Laden: {error}
          </div>
        )}

        {/* Dispatch overview — two scenario cards */}
        {(speditionData || b29Data) && (
          <div className="grid grid-cols-2 gap-6">
            {speditionData && (
              <ScenarioCard
                title="Spedition MLP — 5 Routen"
                subtitle={speditionData.model.architecture}
                modelInfo={[
                  { label: 'MAE', value: `${speditionData.model.mae.toFixed(4)} €/L` },
                  { label: 'R²', value: speditionData.model.r2.toFixed(3) },
                  { label: 'Pick-Acc', value: `${(speditionData.model.pick_accuracy_t1 * 100).toFixed(0)} %` },
                ]}
                savings={`€ ${speditionData.savings.per_day_eur.toFixed(0)}/Tag · 5 Fahrzeuge`}
                tableHead={['Route / Station', 'Preis', 'Best. Fenster']}
                tableRows={speditionData.recommendations.map((r) => ({
                  label: `${r.route} · ${r.station_name}`,
                  price: r.current_price,
                  sub: r.optimal_time_label,
                }))}
                linkTo="/predictions"
              />
            )}
            {b29Data && (
              <ScenarioCard
                title="B29 Fleet MLP — 4 Cluster"
                subtitle={b29Data.model.architecture}
                modelInfo={[
                  { label: 'MAE', value: `${b29Data.model.mae.toFixed(3)} €/L` },
                  { label: 'R²', value: b29Data.model.r2.toFixed(2) },
                  { label: '−MAE', value: `${b29Data.model.mae_improvement_pct.toFixed(0)} % vs Baseline` },
                ]}
                savings={`€ ${b29Data.savings.per_day_eur.toFixed(0)}/Tag · 25 Fahrzeuge`}
                tableHead={['Cluster', 'Preis', 'Opt. Zeitpunkt']}
                tableRows={b29Data.recommendations.map((r) => ({
                  label: r.cluster,
                  price: r.current_price,
                  sub: r.optimal_time_label,
                }))}
                linkTo="/predictions"
              />
            )}
          </div>
        )}

        {/* Price cards */}
        <div className="grid grid-cols-3 gap-4">
          {['e5', 'e10', 'diesel'].map((ft) => (
            <PriceCard
              key={ft}
              fuelType={ft}
              price={currentPrices[ft]}
              change={currentPrices[ft] && prevPrices[ft] ? currentPrices[ft] - prevPrices[ft] : 0}
            />
          ))}
        </div>

        {/* Best time */}
        <BestTimeCard data={bestTime} />

        {/* Price trend chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Preisentwicklung (30 Tage)</h2>
            <div className="flex gap-4">
              {chartDatasets.map(({ fuelType: ft }) => (
                <span key={ft} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: FUEL_COLORS[ft] }}
                  />
                  {FUEL_LABELS[ft]}
                </span>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
              Lade Daten…
            </div>
          ) : (
            <PriceLineChart datasets={chartDatasets} />
          )}
        </div>

        {/* Nearby stations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Günstigste Tankstellen in der Nähe (Aalen)
          </h2>
          {nearbyStations.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Stationen gefunden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Tankstelle</th>
                  <th className="text-right pb-2 font-medium">E5</th>
                  <th className="text-right pb-2 font-medium">E10</th>
                  <th className="text-right pb-2 font-medium">Diesel</th>
                  <th className="text-right pb-2 font-medium">Entfernung</th>
                </tr>
              </thead>
              <tbody>
                {nearbyStations.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-gray-800">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.place}</div>
                    </td>
                    {['e5', 'e10', 'diesel'].map((ft) => (
                      <td key={ft} className="text-right py-2.5">
                        <span
                          className="font-mono font-medium"
                          style={{ color: FUEL_COLORS[ft] }}
                        >
                          {s[ft] ? s[ft].toFixed(3) : '–'}
                        </span>
                      </td>
                    ))}
                    <td className="text-right py-2.5 text-gray-400">{s.dist} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
