import { Link } from 'react-router-dom'
import Eli5 from '../components/Eli5'
import PixelPattern from '../components/ui/PixelPattern'

const KENNZAHLEN = [
  { param: 'Anzahl LKWs', wert: '25' },
  { param: 'Max. Tankkapazität', wert: '1.200 L (40-Tonner)' },
  { param: 'Tagesfahrleistung', wert: 'max. 500 km/Tag (gesetzliches Limit)' },
  { param: 'Kraftstoffverbrauch', wert: '30 L/100 km (beladen)' },
  { param: 'Tagesverbrauch je LKW', wert: '150 L/Tag (500 km × 30 L/100 km)', strong: true },
  { param: 'Tagesverbrauch Flotte', wert: '3.750 L/Tag (25 × 150 L)', strong: true },
  { param: 'Routen', wert: 'N, NE, E, SW, NW — je eine Station' },
  { param: 'Forecast-Horizont', wert: '72 Stunden' },
]

const EINSPARUNG = [
  { vorteil: '1 ct/L', rechnung: '0,01 €/L × 3.750 L', tag: '37,50 €', jahr: '9.375 €' },
  { vorteil: '2 ct/L', rechnung: '0,02 €/L × 3.750 L', tag: '75,00 €', jahr: '18.750 €' },
  { vorteil: '5 ct/L', rechnung: '0,05 €/L × 3.750 L', tag: '187,50 €', jahr: '46.875 €' },
]

const KRITERIEN = [
  { k: 'Cheapest-Station Pick Accuracy', z: 'Wie oft wird die tatsächlich günstigste Station korrekt identifiziert? Zufalls-Baseline: 20 % (1 von 5).' },
  { k: 'Spearman-Rangkorrelation', z: 'Misst, wie gut die vorhergesagte Reihenfolge aller Stationen mit der echten übereinstimmt.' },
  { k: 'MAE (Mean Absolute Error)', z: 'Mittlere Preisabweichung in €/L — möglichst klein.' },
  { k: 'R²', z: 'Anteil der erklärten Preisvarianz — möglichst nah an 1.' },
]

export default function BusinessUnderstanding() {
  return (
    <div className="flex flex-col h-full overflow-auto bg-brand-cream">
      {/* Header */}
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-yellow">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-charcoal/50 mb-1">Schritt 01 · CRISP-DM · Business Understanding</p>
        <h1 className="text-4xl font-bold text-brand-charcoal uppercase leading-none">Business Understanding</h1>
        <p className="text-sm mt-2 text-brand-charcoal/60 max-w-xl">
          Bevor wir Daten oder Modelle anfassen: Welches betriebswirtschaftliche Problem lösen wir
          überhaupt — und woran messen wir Erfolg?
        </p>
        <PixelPattern color1="rgba(28,28,26,0.12)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Rolle im Unternehmen */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Rolle im Unternehmen</h2>
          <p className="text-sm text-gray-600 mb-4">
            Ein Speditionsunternehmen betreibt <strong>25 LKWs</strong> auf fünf Festrouten, die
            jeweils rund 100 km von Aalen entfernt starten. Die Disposition verantwortet die
            Kraftstoffkosten als eine der größten variablen Kostenpositionen im Betrieb.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {KENNZAHLEN.map(r => (
                <tr key={r.param} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-500">{r.param}</td>
                  <td className={`py-2 text-right ${r.strong ? 'font-bold text-brand-charcoal' : 'font-medium text-gray-700'}`}>
                    {r.wert}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Leitfrage */}
        <div className="bg-brand-charcoal text-white p-6 shadow-sm">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-orange mb-2">Betriebswirtschaftliche Fragestellung</p>
          <p className="text-xl font-semibold leading-snug">
            „An welcher unserer fünf Tankstationen ist Diesel in den nächsten 72 Stunden am
            günstigsten — und welchen LKW sollten wir dorthin schicken?"
          </p>
        </div>

        {/* Einsparpotenzial */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Einsparpotenzial</h2>
          <p className="text-sm text-gray-600 mb-4">
            Ein LKW legt täglich maximal 500 km zurück und verbraucht bei 30 L/100 km genau
            <strong> 150 Liter Diesel</strong> — mehr kann er an einem Tag nicht nachtanken,
            unabhängig von der Tankgröße. Für die gesamte Flotte ergibt das
            <strong> 3.750 L/Tag</strong> als realistisches Tagesvolumen.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Preisvorteil</th>
                <th className="text-left pb-2 font-medium">Berechnung</th>
                <th className="text-right pb-2 font-medium">Ersparnis/Tag</th>
                <th className="text-right pb-2 font-medium">Ersparnis/Jahr</th>
              </tr>
            </thead>
            <tbody>
              {EINSPARUNG.map(r => (
                <tr key={r.vorteil} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-semibold text-gray-700">{r.vorteil}</td>
                  <td className="py-2 text-gray-500 font-mono text-xs">{r.rechnung}</td>
                  <td className="py-2 text-right font-mono font-semibold text-green-700">{r.tag}</td>
                  <td className="py-2 text-right font-mono font-bold text-green-700">{r.jahr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">
            (250 Arbeitstage; setzt voraus, dass jeder LKW täglich an der modellgestützt gewählten
            Station tankt)
          </p>
          <Eli5 title="Was wollen wir genau lösen?" className="mt-4">
            Der Disponent entscheidet: Welcher LKW tankt wo? Sagt das Modell, dass Station A in den
            nächsten Stunden günstiger sein wird als Station B, plant er den Rückkehrtank entlang
            dieser Prognose. Unser Modell sagt für die nächsten 72 Stunden voraus, welche der fünf
            Stationen am günstigsten ist — und unterstützt damit die Tourenplanung.
          </Eli5>
        </div>

        {/* Hinweis: Überarbeiteter Business Case */}
        <div className="bg-brand-yellow/30 border border-brand-yellow p-5">
          <h3 className="text-sm font-semibold text-brand-charcoal mb-1">Hinweis: Überarbeiteter Business Case</h3>
          <p className="text-sm text-brand-charcoal/75">
            Der vorliegende Ansatz ist das Ergebnis einer <strong>Kurskorrektur</strong> im
            Projektverlauf. Der ursprüngliche Ansatz (B29-Korridor, regionale Clustervorhersage)
            wurde nach kritischer Prüfung verworfen. Die Gründe sind in der{' '}
            <Link to="/reflexion" className="text-brand-orange font-semibold hover:underline">Reflexion (Schritt 07)</Link>{' '}
            erläutert.
          </p>
        </div>

        {/* ML-Problemtyp und Erfolgskriterien */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">ML-Problemtyp und Erfolgskriterien</h2>
          <p className="text-sm text-gray-600 mb-4">
            Das Problem ist eine <strong>Zeitreihen-Regression</strong>: Aus historischen Preis- und
            Zeitmerkmalen sollen zukünftige Preise vorhergesagt werden.
          </p>
          <div className="space-y-2">
            {KRITERIEN.map(c => (
              <div key={c.k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700">{c.k}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.z}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
