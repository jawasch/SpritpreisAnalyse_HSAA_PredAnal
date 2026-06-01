import { useState, useEffect } from 'react'
import { api, FUEL_LABELS } from '../services/api'
import LongTermPriceChart from '../components/charts/LongTermPriceChart'
import PriceDistributionCloud from '../components/charts/PriceDistributionCloud'
import PriceHeatmaps from '../components/charts/PriceHeatmaps'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'
import Eli5 from '../components/Eli5'
import PixelPattern from '../components/ui/PixelPattern'
import RecordedFigure from '../components/walkthrough/RecordedFigure'
import { formatPrice } from '../utils/format'

const FUEL_TYPES = ['diesel', 'e5', 'e10']

const MAP_SCENARIOS = [
  { value: 'spedition', label: 'Spedition (5 Routen)',  desc: '5 konkrete Stationen · MLP-Prognose 72h' },
  { value: 'b29',       label: 'B29 (4 Cluster)',       desc: 'Korridor Aalen→Stuttgart · Cluster-Geographie' },
  { value: 'all',       label: 'Alle Stationen',        desc: '~95 Regionen · Animation über alle Jahre' },
]

const STATIONSAUSWAHL = [
  { route: 'N',  marke: 'AVIA', ort: 'Ipsheim',    km: '81 km',  ev: '131.857' },
  { route: 'NE', marke: 'AVIA', ort: 'Nürnberg',   km: '98 km',  ev: '111.210' },
  { route: 'E',  marke: 'ESSO', ort: 'Olching',    km: '114 km', ev: '102.641' },
  { route: 'NW', marke: 'AVIA', ort: 'Mühlhausen', km: '109 km', ev: '128.574' },
  { route: 'SW', marke: 'RAN',  ort: 'Biberach',   km: '86 km',  ev: '111.145' },
]

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`bg-white p-4 shadow-sm ${accent ? 'border-l-4 border-brand-orange' : 'border border-gray-200'}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/40 mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-charcoal">{value}</p>
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

function RealBadge({ label = 'Echte Daten (Parquet)' }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
      ✓ {label}
    </span>
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

// ── Interactive map explorer (merged from former Geo-Exploration) ─────────────

function MapExplorer() {
  const [fuelType, setFuelType] = useState('diesel')
  const [date,     setDate]     = useState('')
  const [scenario, setScenario] = useState('spedition')
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    // "Alle Stationen" = regionale Historie (alle Jahre, animiert). Modelle = Live-Prognose.
    const req = scenario === 'all'
      ? api.analytics.regionHistory(fuelType)
      : api.analytics.geoTimeseries(fuelType, date || null, 'hour', 'all', scenario)
    req.then(res => { setData(res); setLoading(false) })
       .catch(err => { setError(String(err)); setLoading(false) })
  }, [fuelType, date, scenario])

  const isNonDiesel = fuelType !== 'diesel' && (scenario === 'spedition' || scenario === 'b29')

  return (
    <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Controls */}
      <div className="bg-brand-cyan/15 border-b border-brand-cyan/30 px-4 py-2.5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {MAP_SCENARIOS.map(s => (
            <button
              key={s.value}
              onClick={() => setScenario(s.value)}
              title={s.desc}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                scenario === s.value ? 'bg-brand-orange text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {FUEL_TYPES.map(ft => (
            <button
              key={ft}
              onClick={() => setFuelType(ft)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                fuelType === ft ? 'bg-brand-charcoal text-white' : 'bg-brand-charcoal/10 text-brand-charcoal hover:bg-brand-charcoal/20'
              }`}
            >
              {FUEL_LABELS[ft]}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-700"
        />
        {date && (
          <button onClick={() => setDate('')} className="text-xs text-gray-400 hover:text-gray-700">Heute</button>
        )}
        {isNonDiesel && (
          <span className="text-xs text-brand-charcoal bg-brand-yellow/50 border border-brand-yellow px-2 py-0.5">
            Modell nur für Diesel — E5/E10 als Näherung
          </span>
        )}
        {data?.meta && (
          <span className="ml-auto text-xs text-gray-400">
            {data.meta.n_stations?.toLocaleString('de-DE')} Stationen · {data.meta.date}
          </span>
        )}
        {error && <span className="ml-auto text-xs text-red-500">{error}</span>}
      </div>

      {/* Map canvas */}
      <div style={{ height: 460 }} className="relative">
        <GeoPriceMap3D data={data} fuelType={fuelType} loading={loading} scenario={scenario} />
      </div>
    </div>
  )
}

export default function DataExploration() {
  const [eda,      setEda]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [edaError, setEdaError] = useState(null)

  useEffect(() => {
    api.eda.summary()
      .then(setEda)
      .catch(e => setEdaError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const cov = eda?.coverage
  const q   = eda?.quality
  const ps  = eda?.price_stats

  return (
    <div className="flex flex-col h-full overflow-auto bg-brand-cream">
      {/* Page header — cyan */}
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-cyan">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 02 · CRISP-DM · Data Understanding</p>
        <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Datenexploration</h1>
        <p className="text-sm mt-2 text-brand-charcoal/60 max-w-xl">
          Bevor wir Modelle bauen, müssen wir die Daten kennen und verstehen — Quelle,
          Stationsauswahl, Geographie und zeitliche Muster.
        </p>
        <PixelPattern color1="rgba(28,28,26,0.10)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">

        {edaError && (
          <div className="bg-brand-yellow/30 border border-brand-yellow p-4 text-sm text-brand-charcoal">
            <strong>EDA-Summary nicht gefunden.</strong> Bitte einmalig ausführen:{' '}
            <code className="bg-brand-yellow/40 px-1.5 rounded text-xs">python scripts/build_eda_summary.py</code>
            <br />
            <span className="text-xs text-brand-charcoal/60 mt-1 block">Fehler: {edaError}</span>
          </div>
        )}

        <Eli5 title="Was ist Datenexploration und warum machen wir das?">
          Stell dir vor, du kaufst ein Gebrauchtauto und schaust nicht in den Motorraum.
          Genauso wäre es, ein KI-Modell auf Daten zu trainieren, die man vorher nie
          angeschaut hat. Die Exploration zeigt uns: Wie viele Datenpunkte haben wir?
          Wo fehlen Preise? Gibt es unlogische Werte wie 0 €/L oder 4 €/L?
          Erst wenn wir das wissen, können wir guten Gewissens modellieren.
        </Eli5>

        {/* Datenquelle Tankerkönig */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Datenquelle: Tankerkönig Open Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Die Datenbasis stammt aus dem <strong>Tankerkönig Open Data</strong>-Projekt: tägliche
            CSV-Dateien mit den Preisänderungen aller deutschen Tankstellen seit 2014.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Rohdaten-Umfang" value="~87 GB" sub="historische CSV-Dateien" accent />
            <StatCard label="Preiseinträge" value="1,1 Mrd." sub="über 4.365 Tage (2014–2026)" />
            <StatCard label="Tankstellen" value="> 15.000" sub="deutschlandweit" accent />
          </div>
        </div>

        {/* Stationsauswahl */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Stationsauswahl — 5 Routen</h2>
          <p className="text-sm text-gray-600 mb-4">
            Für jede der fünf Himmelsrichtungen (N, NE, E, SW, NW) wird aus dem Ring
            <strong> 80–120 km um Aalen</strong> die Station mit der höchsten Datenverfügbarkeit
            ausgewählt. Aus <strong>1.233 Kandidaten</strong> werden fünf Stationen gewählt —
            automatisiert über Haversine-Distanz und Kompasswinkel.
          </p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Route</th>
                <th className="text-left pb-2 font-medium">Marke</th>
                <th className="text-left pb-2 font-medium">Ort</th>
                <th className="text-right pb-2 font-medium">Entfernung</th>
                <th className="text-right pb-2 font-medium">Preis-Ereignisse</th>
              </tr>
            </thead>
            <tbody>
              {STATIONSAUSWAHL.map(r => (
                <tr key={r.route} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-bold text-brand-orange">{r.route}</td>
                  <td className="py-2 text-gray-700">{r.marke}</td>
                  <td className="py-2 text-gray-700">{r.ort}</td>
                  <td className="py-2 text-right font-mono text-gray-600">{r.km}</td>
                  <td className="py-2 text-right font-mono text-gray-600">{r.ev}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Eli5 title="Haversine-Formel — warum nicht einfach Luftlinie auf den Koordinaten?">
            Die euklidische Distanz auf Längen- und Breitengraden liefert für geographische Abstände
            systematisch falsche Ergebnisse, weil Längengrade zum Äquator hin konvergieren. Die
            Haversine-Formel berechnet den <strong>Großkreisabstand</strong> — die kürzeste
            Verbindung zweier Punkte auf der Kugeloberfläche. So weisen wir jede Station sauber einem
            Himmelsrichtungssektor zu und wählen je Sektor die Station mit den meisten Ereignissen.
          </Eli5>
        </div>

        {/* Interaktive Karte */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Interaktive Karte — Preise als Vektoren</h2>
            <RealBadge label="Live aus Backend" />
          </div>
          <MapExplorer />
          <p className="text-xs text-gray-400 mt-2">
            Jeder Pfeil = eine Station · Länge = Preis · Farbe grün (günstig) bis rot (teuer).
            <strong> Spedition</strong>: 5 Routen ab Aalen mit 72-h-Prognose ·
            <strong> B29</strong>: 4 Cluster-Geographien des Korridors Aalen→Stuttgart (hier als
            Daten­ansicht — das B29-Modell selbst ist verworfen, siehe Reflexion) ·
            <strong> Alle Stationen</strong>: alle Stationen je PLZ-Region gemittelt (~95 Regionen),
            animiert über alle Jahre 2014→heute — Spritsorte oben umschaltbar, Tempo unten einstellbar.
          </p>
        </div>

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

        {/* EDA-Befunde Einleitung */}
        <div className="bg-brand-cyan/10 border border-brand-cyan/30 p-5">
          <h2 className="text-sm font-semibold text-brand-charcoal mb-2">Drei Befunde aus der EDA — relevant fürs Modell</h2>
          <ol className="text-sm text-brand-charcoal/75 space-y-1 list-decimal list-inside">
            <li><strong>Hohe Korrelation zwischen allen Stationen</strong> (r &gt; 0,95): Der Rohölpreis treibt alle Preise gemeinsam — lokale Unterschiede sind gering, aber vorhersagbar.</li>
            <li><strong>Intraday-Muster</strong>: Preise steigen morgens, fallen abends. Dieses tägliche Muster ist ein wertvolles Signal.</li>
            <li><strong>Fehlende Stunden</strong>: Tankstellen melden nur bei Änderungen. Stunden ohne Meldung werden per Vorwärtsfüllung (letzter bekannter Preis) aufgefüllt.</li>
          </ol>
          <div className="mt-4 max-w-md">
            <RecordedFigure name="eda_correlation.png" caption="Preis-Korrelation der 5 Stationen (r > 0,95)" />
          </div>
        </div>

        {/* Datenqualität */}
        {q && (
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
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

        {/* Preisverteilung über die Zeit — Dot-Matrix-Cloud */}
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-gray-700">Preisverteilung über die Zeit (Diesel)</h2>
            <RealBadge label="Tankerkönig 2014–heute" />
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Häufigkeit der beobachteten Stundenpreise als Punktwolke: <strong>wann</strong> lag der Preis
            auf <strong>welchem Niveau</strong> und mit <strong>wie vielen Einträgen</strong>.
          </p>
          <PriceDistributionCloud />
        </div>

        {/* Preis-Kennzahlen */}
        {ps && (
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Preis-Kennzahlen</h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">Statistische Zusammenfassung aller Dieselpreise im Datensatz.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
              {[
                { label: 'Mittelwert',   val: ps.mean, color: 'text-brand-orange' },
                { label: 'Median (P50)', val: ps.p50,  color: 'text-gray-700' },
                { label: 'Minimum',      val: ps.min,  color: 'text-green-600' },
                { label: 'Maximum',      val: ps.max,  color: 'text-red-600' },
                { label: 'Std.-Abw.',    val: ps.std,  color: 'text-gray-500' },
                { label: 'P5 / P95', val: `${formatPrice(ps.p05)} / ${formatPrice(ps.p95)}`,
                  color: 'text-gray-500', raw: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className={`text-sm font-mono font-semibold ${row.color}`}>
                    {row.raw ? row.val : `${formatPrice(row.val)} €/L`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intraday-Profil */}
        {eda?.intraday_profile?.length > 0 && (
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-gray-700">Intraday-Preismuster</h2>
              <RealBadge />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Ø Dieselpreis je Tagesstunde über alle verfügbaren Daten.
              Grün = günstig · Gelb = mittel · Rot = teuer.
            </p>
            <Intraday data={eda.intraday_profile} />
            <div className="mt-4 max-w-xl">
              <RecordedFigure name="eda_intraday.png" caption="Intraday-Preismuster — morgens teuer, nachts günstig" />
            </div>
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
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
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

        {/* Langzeit-Trend — interaktiv */}
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-gray-700">Langzeit-Preisverlauf (Diesel · 5 Stationen)</h2>
            <RealBadge label="Tankerkönig 2014–heute" />
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Interaktiv: Zeitfenster wählen, zoomen &amp; verschieben, Stationen ein-/ausblenden, glätten —
            mit Live-Kennzahlen für den sichtbaren Ausschnitt.
          </p>
          <LongTermPriceChart />
        </div>

        {/* Wochentag × Uhrzeit — interaktive Heatmaps */}
        <div className="bg-white border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Wochentag × Uhrzeit — Preisheatmap (Diesel)</h2>
            <RealBadge label="Tankerkönig 2014–heute" />
          </div>
          <PriceHeatmaps />
          <Eli5 title="Die Heatmap als Fahrplan für unser Modell" className="mt-4">
            Die obere 7×24-Tabelle ist im Grunde das Gedächtnis des einfachsten möglichen
            Modells: „Welche Stunde in welchem Wochentag war historisch am günstigsten?"
            Unser MLP lernt dasselbe — aber mit 100+ Features und über 72 Stunden Horizont,
            statt nur einem einzigen Durchschnittswert je Zelle. Die untere Live-Ansicht zeigt,
            wie sich dieses Muster in den letzten Wochen real wiederfindet.
          </Eli5>
        </div>

        {loading && !eda && (
          <div className="bg-white border border-gray-200 p-10 flex items-center justify-center text-brand-charcoal/40 text-sm">
            Lade Explorationsdaten …
          </div>
        )}

      </div>
    </div>
  )
}
