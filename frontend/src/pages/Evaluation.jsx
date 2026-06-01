import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import GeoPriceMap3D from '../components/map/GeoPriceMap3D'
import PickAccuracyChart from '../components/charts/PickAccuracyChart'
import PixelPattern from '../components/ui/PixelPattern'

const METRIKEN = [
  { name: 'MAE — Wie weit daneben im Schnitt?', text: 'Im Durchschnitt liegst du X Cent pro Liter daneben. Kleiner ist besser. 0 wäre perfekt — kommt in der Praxis nicht vor.' },
  { name: 'RMSE — Wie schlimm sind die größten Fehler?', text: 'Wie der MAE, aber große Fehlvorhersagen werden stärker bestraft. Ein RMSE deutlich über dem MAE zeigt: es gibt einzelne Stunden mit starken Abweichungen.' },
  { name: 'R² — Wie viel der Schwankungen erklärt das Modell?', text: '0,0 = so gut wie Raten. 1,0 = alle Preisbewegungen perfekt erklärt. Nahe 1 heißt: das Modell hat Muster verstanden, nicht auswendig gelernt.' },
  { name: 'Pick Accuracy — Trifft das Modell die richtige Station?', text: 'Die zentrale Kennzahl: Wie oft wählt das Modell die tatsächlich günstigste Station? Zufalls-Baseline: 1 von 5 = 20 %.' },
]

const SPEARMAN = [
  ['1,0', 'Stationsreihenfolge wird jederzeit perfekt vorhergesagt'],
  ['≥ 0,8', 'Sehr gutes Ranking — praktisch brauchbar'],
  ['≈ 0,5', 'Schwaches Signal — Reihenfolge teilweise korrekt'],
  ['≈ 0,0', 'Kein Zusammenhang — schlechter als Zufall beim Ranking'],
  ['< 0', 'Systematische Umkehrung der Reihenfolge'],
]

const TESTRESULTS = [
  { metrik: 'MAE',                 base: '0,454 €/L', val: '0,030 €/L', test: '0,026 €/L' },
  { metrik: 'RMSE',                base: '0,485 €/L', val: '0,041 €/L', test: '0,036 €/L' },
  { metrik: 'R²',                  base: '—',         val: '0,953',     test: '0,955' },
  { metrik: 'Skill Score',         base: '—',         val: '—',         test: '94,3 %' },
  { metrik: 'Pick Accuracy (gesamt)', base: '20 %',   val: '—',         test: '46,0 %' },
  { metrik: 'Ø Spearman ρ',        base: '—',         val: '—',         test: '0,496' },
]

const PICK_HORIZON = [
  { h: 't+1h',  acc: '50,0 %', note: 'gut' },
  { h: 't+24h', acc: '51,3 %', note: 'Maximum — Tagesrhythmus-Muster greifen', max: true },
  { h: 't+48h', acc: '49,1 %', note: 'leicht rückläufig' },
  { h: 't+72h', acc: '47,7 %', note: 'schwächste Stunden, noch 2,4× über Zufall' },
]

const KOSTEN = [
  { szenario: 'Zufall (Baseline)', rechnung: '7,93 ct × 80 % Miss × 3.750 L', kosten: '237,90 €' },
  { szenario: 'MLP-Routing',       rechnung: '7,93 ct × 54 % Miss × 3.750 L',  kosten: '160,73 €' },
]

export default function Evaluation() {
  const [data,    setData]    = useState(null)
  const [geoData, setGeoData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.predictions.spedition().catch(() => null),
      api.analytics.geoTimeseries('diesel', null, 'hour', 'all', 'spedition').catch(() => null),
    ]).then(([sp, geo]) => {
      setData(sp)
      setGeoData(geo)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col h-full overflow-auto bg-brand-cream">
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-orange">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 05 · CRISP-DM · Evaluation</p>
        <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Evaluation</h1>
        <p className="text-sm mt-2 text-brand-charcoal/60 max-w-xl">
          Wie gut ist das Modell wirklich? Metriken, Testergebnisse, kritische Interpretation und
          der betriebswirtschaftliche Impact.
        </p>
        <PixelPattern color1="rgba(28,28,26,0.12)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Metriken erklärt */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Metriken — einfach erklärt</h2>
          <div className="space-y-2 mb-4">
            {METRIKEN.map(m => (
              <div key={m.name} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700">{m.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.text}</p>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Spearman-Rangkorrelation ρₛ — stimmt die Reihenfolge?</h3>
          <p className="text-xs text-gray-500 mb-3">
            Für die Dispatch-Entscheidung zählt das Ranking der Stationen, nicht der exakte Centbetrag.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {SPEARMAN.map(r => (
                <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-mono font-semibold text-brand-orange w-20">{r[0]}</td>
                  <td className="py-2 text-gray-600">{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Testergebnisse */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Testergebnisse</h2>
          <p className="text-sm text-gray-600 mb-4">
            Der Testdatensatz umfasst <strong>20.829 Einträge</strong> (Jan 2024 – Mai 2026) — Daten,
            die das Modell während des Trainings nie gesehen hat.
          </p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Metrik</th>
                <th className="text-right pb-2 font-medium">Baseline (Dummy)</th>
                <th className="text-right pb-2 font-medium">MLP Validation</th>
                <th className="text-right pb-2 font-medium">MLP Test</th>
              </tr>
            </thead>
            <tbody>
              {TESTRESULTS.map(r => (
                <tr key={r.metrik} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-semibold text-gray-700">{r.metrik}</td>
                  <td className="py-2 text-right font-mono text-gray-500">{r.base}</td>
                  <td className="py-2 text-right font-mono text-gray-600">{r.val}</td>
                  <td className="py-2 text-right font-mono font-bold text-green-700">{r.test}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Skill Score — um wie viel besser als die triviale Baseline</p>
            <p className="font-mono text-sm text-gray-700">
              Skill = (1 − 0,026 / 0,454) × 100 = <strong className="text-green-700">94,3 %</strong>
            </p>
          </div>
        </div>

        {/* Pick-Accuracy live chart + Horizont-Tabelle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Pick-Accuracy nach Horizont</h3>
            <p className="text-xs text-gray-400 mb-4">Anteil korrekt vorhergesagter günstigster Stationen · Test 2024+</p>
            {loading && <div className="text-gray-400 text-sm py-10 text-center">Lade Modelldaten …</div>}
            {data && (
              <PickAccuracyChart
                data={data.pick_accuracy_by_horizon}
                yKey="accuracy"
                yLabel="Pick-Accuracy"
                referenceValue={0.20}
                referenceLabel="Zufall (20 %)"
                formatY={v => `${(v * 100).toFixed(0)} %`}
              />
            )}
          </div>
          <div className="bg-white border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pick-Accuracy je ausgewähltem Horizont</h3>
            <table className="w-full text-sm">
              <tbody>
                {PICK_HORIZON.map(r => (
                  <tr key={r.h} className={`border-b border-gray-50 last:border-0 ${r.max ? 'bg-green-50' : ''}`}>
                    <td className="py-2 font-mono text-gray-700 w-16">{r.h}</td>
                    <td className={`py-2 font-mono font-semibold w-20 ${r.max ? 'text-green-700' : 'text-gray-700'}`}>{r.acc}</td>
                    <td className="py-2 text-xs text-gray-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">
              Das Modell ist bei <strong>t+24h</strong> am präzisesten — der Tagesrhythmus (Preise
              steigen morgens, fallen abends) ist bei 24h-Vorschau besonders ausgeprägt.
            </p>
          </div>
        </div>

        {/* Modell-Preis-Feld (Karte) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Modell-Preis-Feld — die Prognose im Raum</h2>
          </div>
          <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ height: 440 }}>
            <GeoPriceMap3D data={geoData} fuelType="diesel" loading={loading} scenario="spedition" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Jeder Vektor zeigt eine der 5 Stationen — Länge = vorhergesagter Preis, Farbe grün
            (günstig) bis rot (teuer). Der Zeit-Slider bewegt durch die 72h-Prognose.
          </p>
        </div>

        {/* Kritische Interpretation */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Kritische Interpretation</h2>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Zwei Schichten: Preisniveau vs. Stationsranking</h3>
            <p className="text-sm text-gray-600">
              <strong>R² = 0,955 / MAE = 0,026 €/L</strong> messen, wie gut das absolute Preisniveau
              vorhergesagt wird — im Schnitt 2,6 ct/L daneben, bei ~1,80 €/L nur ~1,4 % relative
              Abweichung. <strong>Pick Accuracy 46,0 % / Spearman ρ = 0,496</strong> messen die
              <em> Reihenfolge</em> der Stationen — hier ist das Bild schwächer. Folgen alle fünf
              Stationen demselben Trend und unterscheiden sich nur um wenige Cent, reicht eine kleine
              Fehlvorhersage, um die Rangfolge zu vertauschen.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Paradoxon: Testfehler &lt; Validierungsfehler</h3>
            <p className="text-sm text-gray-600">
              Das Modell macht auf dem Test (2024–2026) <em>geringere</em> Fehler als auf der
              Validierung (2022–2023). Der Validierungszeitraum fällt in die europäische Energiekrise
              nach dem russischen Angriff auf die Ukraine: Diesel stieg von ~1,55 €/L auf über
              2,30 €/L und schwankte außergewöhnlich stark — ein Regime, das im Training (2014–2021)
              kaum vorkommt. Der höhere Validierungsfehler ist <strong>kein Overfitting</strong>,
              sondern ein Abbild echter Marktturbulenzen.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Generalisierung ist gegeben</h3>
            <p className="text-sm text-gray-600">
              Trainiert auf Daten bis Ende 2021, erzielt das Modell auf 2024–2026 R² = 0,955. Die hohe
              Skill Score (94,3 %) zeigt: Das Modell hat generalisierbare Strukturen gelernt und nicht
              die Preisniveaus eines spezifischen Zeitraums auswendig.
            </p>
          </div>
        </div>

        {/* Kosten-Impact-Simulation */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Kosten-Impact-Simulation</h2>
          <p className="text-sm text-gray-600 mb-4">
            Basis: realistisches Tagesvolumen der Flotte (25 LKWs × 150 L/Tag = 3.750 L). Der
            durchschnittliche Preisspread zwischen günstigster und teuerster Station beträgt
            <strong> 7,93 ct/L</strong> (Mittel über alle 72 Horizonte und 20.829 Stunden).
          </p>
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Szenario</th>
                <th className="text-left pb-2 font-medium">Berechnung</th>
                <th className="text-right pb-2 font-medium">Mehrkosten/Tag</th>
              </tr>
            </thead>
            <tbody>
              {KOSTEN.map(r => (
                <tr key={r.szenario} className="border-b border-gray-50">
                  <td className="py-2 font-semibold text-gray-700">{r.szenario}</td>
                  <td className="py-2 text-gray-500 font-mono text-xs">{r.rechnung}</td>
                  <td className="py-2 text-right font-mono text-gray-700">{r.kosten}</td>
                </tr>
              ))}
              <tr className="bg-green-50">
                <td className="py-2 font-bold text-green-800" colSpan={2}>Einsparung vs. Zufall</td>
                <td className="py-2 text-right font-mono font-bold text-green-700">77,17 €/Tag ≈ 19.300 €/Jahr</td>
              </tr>
            </tbody>
          </table>
          <Eli5 title="Warum 7,93 ct/L statt 1 ct/L aus Schritt 01?">
            Der Spread von 7,93 ct/L ist ein Durchschnitt über <em>alle</em> Horizonte und Stunden —
            also auch Zeitfenster mit ungewöhnlich hoher Preisspreizung. Für kurzfristige
            Entscheidungen (t+1h bis t+8h) ist er realistischer als für 72h-Prognosen. Die Einsparung
            setzt zudem voraus, dass der Disponent konsequent der Modellempfehlung folgt.
          </Eli5>
        </div>

      </div>
    </div>
  )
}
