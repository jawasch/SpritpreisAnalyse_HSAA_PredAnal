import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import PriceLineChart from '../components/charts/PriceLineChart'
import TimeHeatmap from '../components/charts/TimeHeatmap'
import Eli5 from '../components/Eli5'

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function QualityBadge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
    }`}>
      <span>{ok ? '✓' : '!'}</span>
      {label}
    </span>
  )
}

function MockBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
      ⚠ Mock-Daten
    </span>
  )
}

function RealBadge({ label = 'Echte Daten (B29-Parquet)' }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
      ✓ {label}
    </span>
  )
}

function PriceHistogram({ data, nOutliersHigh = 0 }) {
  if (!data?.length) return null

  // Remove trailing empty bins (keep up to last non-zero count)
  let lastNonZero = data.length - 1
  while (lastNonZero > 0 && data[lastNonZero].count === 0) lastNonZero--
  const visible = data.slice(0, lastNonZero + 1)
  const maxCount = Math.max(...visible.map(b => b.count))

  return (
    <div>
      <div className="flex items-end gap-0.5 h-32">
        {visible.map((bin, i) => {
          const pct = maxCount > 0 ? (bin.count / maxCount) * 100 : 0
          const price = ((bin.bin_left + bin.bin_right) / 2).toFixed(2)
          if (bin.count === 0) {
            // Show empty bin as transparent placeholder to preserve x-axis scale
            return <div key={i} className="flex-1" />
          }
          return (
            <div
              key={i}
              className="flex-1 flex items-end"
              title={`${price} €/L: ${bin.count.toLocaleString('de-DE')} Stunden`}
            >
              <div
                className="w-full bg-blue-400 hover:bg-blue-500 rounded-t transition-colors cursor-default"
                style={{ height: `${Math.max(1, pct)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{visible[0]?.bin_left.toFixed(2)} €/L</span>
        <span>{visible[Math.floor(visible.length / 2)]?.bin_left.toFixed(2)} €/L</span>
        <span>{visible[visible.length - 1]?.bin_right.toFixed(2)} €/L</span>
      </div>
      {nOutliersHigh > 0 && (
        <p className="text-[10px] text-amber-600 mt-2">
          + {nOutliersHigh.toLocaleString('de-DE')} Messwerte {'>'} 3,50 €/L ausgeblendet
        </p>
      )}
    </div>
  )
}

function Intraday({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div>
      <div className="flex items-end gap-0.5 h-20">
        {data.map(d => {
          const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
          const color = t < 0.4 ? '#22c55e' : t < 0.7 ? '#f59e0b' : '#ef4444'
          return (
            <div
              key={d.hour}
              className="flex-1 rounded-t"
              style={{ height: `${Math.max(8, t * 100)}%`, background: color, opacity: 0.85 }}
              title={`${d.hour}:00 — ${d.avg_price.toFixed(4)} €/L (${d.relative > 0 ? '+' : ''}${(d.relative * 100).toFixed(1)} ct/L)`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
    </div>
  )
}

function WeekdayBar({ data }) {
  if (!data?.length) return null
  const min = Math.min(...data.map(d => d.avg_price))
  const max = Math.max(...data.map(d => d.avg_price))
  return (
    <div className="flex gap-2 items-end h-16">
      {data.map(d => {
        const t = max > min ? (d.avg_price - min) / (max - min) : 0.5
        const color = t < 0.4 ? '#22c55e' : t < 0.7 ? '#f59e0b' : '#ef4444'
        return (
          <div key={d.dow} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(12, t * 64)}px`, background: color, opacity: 0.85 }}
              title={`${d.label}: ${d.avg_price.toFixed(4)} €/L`}
            />
            <span className="text-xs text-gray-500">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function DataExploration() {
  const [eda,          setEda]          = useState(null)
  const [heatmap,      setHeatmap]      = useState(null)
  const [history,      setHistory]      = useState([])
  const [historyMock,  setHistoryMock]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [edaError,     setEdaError]     = useState(null)

  useEffect(() => {
    Promise.all([
      api.eda.summary().catch(e => { setEdaError(String(e)); return null }),
      api.analytics.heatmap('diesel').catch(() => null),
      api.prices.history('diesel', 365).catch(() => null),
    ]).then(([edaData, hm, hist]) => {
      setEda(edaData)
      setHeatmap(hm)
      const histData = hist?.data || []
      setHistory(histData)
      // station_count=25 means mock_data.py, =4 means real B29 clusters
      setHistoryMock(histData.length > 0 && histData[0]?.station_count === 25)
      setLoading(false)
    })
  }, [])

  const cov = eda?.coverage
  const q   = eda?.quality
  const ps  = eda?.price_stats

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Schritt 01</span>
          <h1 className="text-xl font-bold text-gray-900">Datenexploration</h1>
        </div>
        <p className="text-sm text-gray-500 max-w-3xl">
          Bevor wir Modelle bauen, müssen wir die Daten <strong>kennen und verstehen</strong>.
          Was steckt in den 15.000+ Tankstellen-Datensätzen? Gibt es Ausreißer, Lücken, Muster?
          Diese Seite zeigt die Rohdaten so wie sie sind — ehrlich und ungefiltert.
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">

        {edaError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>EDA-Summary nicht gefunden.</strong> Bitte einmalig ausführen:{' '}
            <code className="bg-amber-100 px-1.5 rounded text-xs">python scripts/build_eda_summary.py</code>
            <br />
            <span className="text-xs text-amber-600 mt-1 block">Fehler: {edaError}</span>
          </div>
        )}

        <Eli5 title="Was ist Datenexploration und warum machen wir das?">
          Stell dir vor, du kaufst ein Gebrauchtauto und schaust nicht in den Motorraum.
          Genauso wäre es, ein KI-Modell auf Daten zu trainieren, die man vorher nie
          angeschaut hat. Die Exploration zeigt uns: Wie viele Datenpunkte haben wir?
          Wo fehlen Preise? Gibt es unlogische Werte wie 0 €/L oder 4 €/L?
          Erst wenn wir das wissen, können wir guten Gewissens modellieren.
        </Eli5>

        {/* Datenzensus */}
        {cov && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Datenzensus</h2>
              <RealBadge />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Stationen gesamt"
                value={(eda.station_census?.total_stations || '—').toLocaleString?.('de-DE') ?? '—'}
                sub="Tankerkönig-Datenbank"
                accent
              />
              <StatCard
                label="Stündliche B29-Messungen"
                value={cov.b29?.n_rows?.toLocaleString('de-DE') ?? '—'}
                sub={cov.b29 ? `${cov.b29.start} – ${cov.b29.end}` : ''}
              />
              <StatCard
                label="Stündliche Speditions-Messungen"
                value={cov.spedition?.n_rows?.toLocaleString('de-DE') ?? '—'}
                sub={cov.spedition ? `${cov.spedition.start} – ${cov.spedition.end}` : ''}
              />
              <StatCard
                label="Datenzeitraum"
                value={`${new Date(cov.b29?.start || cov.spedition?.start).getFullYear() || '2014'} – heute`}
                sub="10+ Jahre Preishistorie"
                accent
              />
            </div>
          </div>
        )}

        {/* Datenqualität */}
        {q && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Datenqualität</h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Rohdaten aus 15.000+ Stationen enthalten systematische Probleme —
              hier die wichtigsten Kennzahlen auf einen Blick.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <QualityBadge ok={q.missing_pct < 5}  label={`${q.missing_pct.toFixed(1)} % fehlende Werte`} />
              <QualityBadge ok={q.n_zero_prices === 0} label={`${q.n_zero_prices.toLocaleString('de-DE')} Nullpreise`} />
              <QualityBadge ok={q.n_outlier_high_250 < 100} label={`${q.n_outlier_high_250.toLocaleString('de-DE')} Ausreißer > 2,50 €/L`} />
              <QualityBadge ok={q.n_outlier_low_080 < 100}  label={`${q.n_outlier_low_080.toLocaleString('de-DE')} Ausreißer < 0,80 €/L`} />
            </div>
            <Eli5 title="Was bedeuten Nullpreise und Ausreißer?">
              Im Tankerkönig-Rohdatensatz gibt es Einträge mit Preis 0 €/L — das passiert, wenn
              eine Tankstelle schließt und keinen Preis mehr meldet. Ausreißer über 2,50 €/L
              können echte Extrempreise sein (z. B. Krisen), aber auch Datenfehler.
              Wir filtern alle Preise unter 0,80 €/L und über 3,50 €/L vor dem Training heraus.
            </Eli5>
          </div>
        )}

        {/* Preisverteilung + Histogramm */}
        {ps && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Preisverteilung (Diesel, B29)</h2>
                <RealBadge />
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Häufigkeit der beobachteten Stundenpreise (0,80–3,50 €/L).
                Jeder Balken = ein Preisbereich · Höhe = Anzahl Stunden.
                {ps.n_outliers_high > 0 && ` Extreme Ausreißer separat ausgewiesen.`}
              </p>
              <PriceHistogram
                data={ps.histogram}
                nOutliersHigh={ps.n_outliers_high ?? 0}
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Preis-Kennzahlen</h2>
                <RealBadge />
              </div>
              <p className="text-xs text-gray-400 mb-4">Statistische Zusammenfassung aller Dieselpreise im B29-Datensatz.</p>
              <div className="space-y-2">
                {[
                  { label: 'Mittelwert',   val: ps.mean, color: 'text-blue-600' },
                  { label: 'Median (P50)', val: ps.p50,  color: 'text-gray-700' },
                  { label: 'Minimum',      val: ps.min,  color: 'text-green-600' },
                  { label: 'Maximum',      val: ps.max,  color: 'text-red-600' },
                  { label: 'Std.-Abw.',    val: ps.std,  color: 'text-gray-500' },
                  { label: 'P5 / P95', val: `${ps.p05?.toFixed(3)} / ${ps.p95?.toFixed(3)}`,
                    color: 'text-gray-500', raw: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className={`text-sm font-mono font-semibold ${row.color}`}>
                      {row.raw ? row.val : `${row.val?.toFixed(4)} €/L`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Intraday-Profil */}
        {eda?.intraday_profile?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Intraday-Preismuster</h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Ø Dieselpreis je Tagesstunde über alle verfügbaren Daten.
              Grün = günstig · Gelb = mittel · Rot = teuer.
            </p>
            <Intraday data={eda.intraday_profile} />
            <Eli5 title="Warum ist Tanken morgens oft günstiger?" className="mt-4">
              Kraftstoffhändler passen Preise mehrfach täglich an. Erfahrungsgemäß
              sinken Preise nach Mitternacht ab — Tankstellen wollen Lager loswerden.
              Zwischen 6 und 9 Uhr ziehen Preise wieder an, wenn der Berufsverkehr einsetzt.
              Dieses Muster ist kein Zufall: Es ist genau das, was unser Modell später
              in Features (sin/cos der Stunde) kodiert.
            </Eli5>
          </div>
        )}

        {/* Wochentagsmuster */}
        {eda?.weekday_pattern?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Wochentags-Preismuster</h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Samstag und Sonntag sind im Schnitt günstiger — Tankstellen konkurrieren stärker
              am Wochenende, wenn Freizeitfahrer preisbewusster sind.
            </p>
            <WeekdayBar data={eda.weekday_pattern} />
          </div>
        )}

        {/* Langzeit-Trend */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Langzeit-Preisverlauf (Diesel, B29)</h2>
              {historyMock ? <MockBadge /> : <RealBadge label="Echte B29-Tagesmittel" />}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {historyMock
                ? 'Zeigt aktuell Mock-Daten (Fallback). Backend-Verbindung oder Parquet-Pfad prüfen.'
                : 'Tägliche Durchschnittspreise (Mittel der 4 B29-Cluster: Aalen, Schwäbisch Gmünd, Schorndorf, Stuttgart).'}
            </p>
            <PriceLineChart datasets={[{ fuelType: 'diesel', data: history }]} />
          </div>
        )}

        {/* Wochentags-Stunden-Heatmap */}
        {heatmap && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">
                Wochentag × Uhrzeit — Preisheatmap (Diesel)
              </h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Jede Zelle = Ø-Preis an diesem Wochentag zu dieser Uhrzeit (letzte 90 Tage).
              Grün = günstig · Rot = teuer · Hover für Details.
            </p>
            <TimeHeatmap data={heatmap.data} overallAvg={heatmap.overall_avg} />
            <Eli5 title="Die Heatmap als Fahrplan für unser Modell" className="mt-4">
              Diese 7×24-Tabelle ist im Grunde das Gedächtnis des einfachsten möglichen
              Modells: „Welche Stunde in welchem Wochentag war historisch am günstigsten?"
              Unser MLP lernt dasselbe — aber mit 100+ Features und über 72 Stunden Horizont,
              statt nur einem einzigen Durchschnittswert je Zelle. Man sieht: der Ansatz
              stimmt. Das Modell verfeinert nur, was diese Heatmap bereits zeigt.
            </Eli5>
          </div>
        )}

        {loading && !eda && !heatmap && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center text-gray-400 text-sm">
            Lade Explorationsdaten …
          </div>
        )}

      </div>
    </div>
  )
}
