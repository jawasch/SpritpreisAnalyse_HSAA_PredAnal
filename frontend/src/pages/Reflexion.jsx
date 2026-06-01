import { useState, useEffect } from 'react'
import { api } from '../services/api'
import Eli5 from '../components/Eli5'
import MultiStationForecastChart from '../components/charts/MultiStationForecastChart'
import PixelPattern from '../components/ui/PixelPattern'

const STAERKEN = [
  'Große, historisch konsistente Datenbasis (10+ Jahre, stündliche Auflösung)',
  'Automatisierte Stationsauswahl — nachvollziehbar per Haversine-Distanz und Datenverfügbarkeit',
  'Multi-Output-Ansatz — ein Modell für alle Stationen und alle 72 Horizonte',
  'Kein Datenleck möglich — Scaler und Split werden zeitlich korrekt angewendet',
  'Vollständig reproduzierbar — alle Parameter zentral definiert, Caching verhindert doppelte Rechenarbeit',
]

const GRENZEN = [
  ['Keine statistische Ausreißerbehandlung (nur untere Schranke)', 'IQR- oder quantilbasierter Filter im load_raw_prices-Schritt'],
  ['Statische Datenbasis — kein automatisches Nachladen', 'Stündlicher Tankerkönig-API-Abruf, Merge in den Cache'],
  ['Externe Preistreiber fehlen (Rohöl, Steuern)', 'Rohölpreis-API als zusätzliches Feature einbinden'],
  ['Nur 5 feste Stationen', 'Dynamische Stationsauswahl nach Routenplanung'],
  ['MLP ist eine Black Box', 'SHAP-Analyse zur Erklärung der Feature-Wichtigkeit'],
  ['Alternativen ungeprüft', 'Vergleich mit LSTM oder Gradient Boosting (XGBoost)'],
]

export default function Reflexion() {
  const [b29Data, setB29Data] = useState(null)

  useEffect(() => {
    api.predictions.b29().catch(() => null).then(setB29Data)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-auto bg-brand-cream">
      <header className="relative overflow-hidden shrink-0 px-8 py-6 bg-brand-charcoal">
        <p className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-1">Schritt 07 · CRISP-DM · Reflexion</p>
        <h1 className="text-4xl font-bold text-white uppercase leading-none">Reflexion</h1>
        <p className="text-sm mt-2 text-white/60 max-w-xl">
          Was wir verworfen haben und warum, wo die Stärken liegen, wo die Grenzen — und wie es
          weitergehen könnte.
        </p>
        <PixelPattern color1="rgba(255,255,255,0.06)" color2="transparent" steps={4}
          className="absolute top-0 right-0" />
      </header>

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Kurskorrektur */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <span className="inline-block text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-semibold mb-3">
            Verworfener Ansatz
          </span>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Kurskorrektur — warum der ursprüngliche Business Case verworfen wurde</h2>
          <p className="text-sm text-gray-600 mb-4">
            Der erste Entwurf arbeitete mit einem anderen Szenario: Eine Spedition auf der
            <strong> B29 (Aalen → Stuttgart)</strong> sollte ihren Fahrern mitteilen, in welcher
            <em> Region</em> (nicht an welcher konkreten Station) sie tanken sollen. Dafür wurden bis
            zu 80 Tankstellen in <strong>vier geografischen Clustern</strong> zu einem regionalen
            Stundendurchschnitt zusammengefasst und ein MLP (<strong>80 Features → 288 Ausgaben</strong>)
            auf diesen Clusterdaten trainiert.
          </p>

          {b29Data?.clusters?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">B29-Cluster-Prognose (der verworfene Ansatz)</h3>
              <p className="text-xs text-gray-400 mb-3">4 Cluster · Aalen → Stuttgart · zur Illustration erhalten</p>
              <MultiStationForecastChart stations={b29Data.clusters.map(c => ({ ...c, name: c.label })) || []} />
            </div>
          )}

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Problem 1 — Kein echter Mehrwert gegenüber bestehenden Lösungen</h3>
              <p className="text-xs text-gray-600">
                Fahrer sehen über frei verfügbare Apps (TankerApp, clever-tanken) den aktuellen Preis
                jeder nahen Tankstelle in Echtzeit. Ein 72-Stunden-Forecast für eine Region liefert
                keinen Vorteil gegenüber dem Blick in die App kurz vor dem Abbiegen — <strong>Nowcasting
                wäre ausreichend gewesen</strong>. Das Modell hätte ein Problem gelöst, das in der
                Praxis nicht existiert.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Problem 2 — Künstlich einfache Vorhersage durch Mittelwertbildung</h3>
              <p className="text-xs text-gray-600">
                Das Zusammenfassen von bis zu 80 Einzelstationen zu einem Clusterdurchschnitt
                <strong> glättet den Preis erheblich</strong>: Kurzfristige Schwankungen einzelner
                Stationen verschwinden im Mittel. Das Modell musste nur noch langsame Makrotrends
                erkennen — die guten Metriken wären kein Zeichen für ein starkes Modell gewesen,
                sondern ein Artefakt der Datenvorbereitung.
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <h3 className="text-sm font-semibold text-green-800 mb-1">Die Konsequenz: Pivot auf das Speditionsszenario</h3>
            <p className="text-xs text-green-700">
              Fünf konkrete Einzelstationen statt Cluster: Hier ist der Spread zwischen Stationen real
              und variabel, Nowcasting ersetzt keine Vorausplanung (der Disponent braucht 72h Vorlauf
              für die Tourenplanung), und die Vorhersage ist schwieriger — womit gute Metriken
              tatsächlich etwas bedeuten.
            </p>
          </div>
        </div>

        {/* Stärken */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Stärken des Projekts</h2>
          <ul className="space-y-2">
            {STAERKEN.map(s => (
              <li key={s} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Grenzen & Verbesserungen */}
        <div className="bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Grenzen und mögliche Verbesserungen</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Grenze</th>
                <th className="text-left pb-2 font-medium">Verbesserungsansatz</th>
              </tr>
            </thead>
            <tbody>
              {GRENZEN.map(r => (
                <tr key={r[0]} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-700 pr-4">{r[0]}</td>
                  <td className="py-2 text-gray-500">{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ausblick: All-Germany */}
        <div className="bg-brand-cyan/15 border border-brand-cyan/40 p-6">
          <span className="inline-block text-xs bg-brand-cyan/40 text-brand-charcoal rounded-full px-2.5 py-0.5 font-semibold mb-3">
            Ausblick
          </span>
          <h2 className="text-lg font-bold text-brand-charcoal mb-2">All-Germany MLP — mehr Modelldaten in Zukunft</h2>
          <p className="text-sm text-brand-charcoal/75 mb-3">
            Ein breiterer Ansatz für die Zukunft: Alle 9 Standorte (4 frühere B29-Cluster + 5
            Speditions-Stationen) kombiniert, alle <strong>3 Kraftstofftypen</strong> (Diesel, E5,
            E10) als Features — <strong>519 Input-Features</strong> pro Kraftstoff, ein Modell je
            Kraftstofftyp. Mehr Daten ermöglichen, regionsübergreifende Wechselwirkungen zu lernen
            (z. B. dass ein Preisanstieg in Stuttgart dem in Aalen vorausläuft).
          </p>
          <p className="text-xs text-brand-charcoal/60">
            Dokumentiert im Notebook <code className="bg-brand-cyan/30 px-1 text-[11px]">all_germany_web_mlp.ipynb</code> —
            unter <strong>Notebooks</strong> direkt durchstöberbar.
          </p>
          <Eli5 title="Warum ist das ein Ausblick und nicht das Hauptmodell?" className="mt-4">
            Das Speditions-Modell ist das fertige, ausgewertete und produktiv einsetzbare Template
            dieses Projekts. Das All-Germany-Modell zeigt, wie sich derselbe Ansatz mit deutlich mehr
            Daten skalieren ließe — es ist die nächste Ausbaustufe, kein Ersatz für das saubere,
            fokussierte Fünf-Stationen-Modell.
          </Eli5>
        </div>

        {/* Schluss-Ausblick */}
        <div className="bg-brand-charcoal text-white p-6">
          <h2 className="text-lg font-bold mb-2">Ausblick</h2>
          <p className="text-sm text-white/75">
            Das Modell ist ein erster, funktionsfähiger Baustein für ein datengetriebenes
            Fuhrparkmanagementsystem. Kombiniert mit Echtzeitpreisen, Tankstandssensoren und
            Routenoptimierung entsteht ein vollständiges Kraftstoff-Kostenoptimierungssystem — mit
            messbarem Einfluss auf die Betriebskosten der Spedition.
          </p>
        </div>

      </div>
    </div>
  )
}
