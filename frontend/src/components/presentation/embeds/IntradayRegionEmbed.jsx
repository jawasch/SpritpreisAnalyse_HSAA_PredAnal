import { useState, useEffect } from 'react'
import { api } from '../../../services/api'
import IntradayByRegionChart from '../../charts/IntradayByRegionChart'

/**
 * Live "Mittlerer Dieselpreis je Stunde und Region" (PDF S.11). Fetches the
 * per-region hourly means from /eda/intraday-by-region and renders the 5-line chart.
 */
export default function IntradayRegionEmbed() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.eda.intradayByRegion().then(setData).catch(e => setError(String(e)))
  }, [])

  if (error) return <div className="text-sm text-red-500">Intraday-Daten nicht verfügbar: {error}</div>
  if (!data)  return <div className="text-sm text-brand-charcoal/40">Lade Intraday-Profil …</div>

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-gray-200 shadow-sm rounded p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1 shrink-0">Intraday-Profil — Mittlerer Dieselpreis je Stunde und Region</h3>
      <p className="text-xs text-gray-400 mb-3 shrink-0">5 Routen · live aus dem Spedition-Datensatz · Maus für Stundenwerte</p>
      <div className="flex-1 min-h-0"><IntradayByRegionChart data={data} /></div>
    </div>
  )
}
