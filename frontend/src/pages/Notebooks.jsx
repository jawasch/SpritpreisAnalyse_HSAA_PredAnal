import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import PixelPattern from '../components/ui/PixelPattern'

const DEFAULT_NOTEBOOK = 'spedition_mlp.ipynb'

export default function Notebooks() {
  const [notebooks, setNotebooks]   = useState([])
  const [selected, setSelected]     = useState(DEFAULT_NOTEBOOK)
  const [html, setHtml]             = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingHtml, setLoadingHtml] = useState(false)
  const [error, setError]           = useState(null)
  const iframeRef = useRef(null)

  // Load notebook list on mount
  useEffect(() => {
    api.notebooks.list()
      .then(res => {
        setNotebooks(res.notebooks || [])
        setLoadingList(false)
        // Auto-select default if present, otherwise first in list
        const names = (res.notebooks || []).map(n => n.name)
        if (!names.includes(DEFAULT_NOTEBOOK) && names.length > 0) {
          setSelected(names[0])
        }
      })
      .catch(err => {
        setError(String(err))
        setLoadingList(false)
      })
  }, [])

  // Load HTML whenever selection changes
  useEffect(() => {
    if (!selected) return
    setLoadingHtml(true)
    setError(null)
    api.notebooks.html(selected)
      .then(res => {
        setHtml(res.html || '')
        setLoadingHtml(false)
      })
      .catch(err => {
        setError(String(err))
        setLoadingHtml(false)
      })
  }, [selected])

  const selectedMeta = notebooks.find(n => n.name === selected)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar — notebook list */}
      <aside className="w-64 shrink-0 bg-brand-charcoal flex flex-col overflow-hidden">
        <div className="relative overflow-hidden px-4 py-4 border-b border-white/10">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-0.5">Schritt 06 · CRISP-DM</p>
          <h2 className="text-sm font-bold text-white uppercase">Notebooks</h2>
          <p className="text-xs text-white/30 mt-0.5">Analyseergebnisse</p>
          <PixelPattern color1="rgba(255,255,255,0.06)" color2="transparent" size={20} steps={3}
            className="absolute top-0 right-0" />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {loadingList && (
            <p className="text-xs text-white/30 px-2 py-4 text-center">Lade …</p>
          )}
          {!loadingList && notebooks.length === 0 && (
            <p className="text-xs text-white/30 px-2 py-4 text-center">
              Keine Notebooks gefunden
            </p>
          )}
          {notebooks.map(nb => (
            <button
              key={nb.name}
              onClick={() => setSelected(nb.name)}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                selected === nb.name
                  ? 'bg-brand-orange text-white'
                  : 'text-white/55 hover:bg-white/8 hover:text-white/80'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-medium leading-snug">
                  {nb.display_name}
                </span>
                {nb.has_outputs && (
                  <span className="shrink-0 mt-0.5 inline-block w-2 h-2 rounded-full bg-brand-cyan" title="Hat Ausgaben" />
                )}
              </div>
              <span className="text-xs opacity-40">{nb.size_kb} KB</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right panel — rendered notebook */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Notebook header bar */}
        <div className="px-4 py-2 border-b-2 border-brand-charcoal/10 bg-brand-cream flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-brand-charcoal uppercase tracking-wide">
            {selectedMeta?.display_name ?? selected}
          </span>
          {selectedMeta && (
            <span className="text-xs text-brand-charcoal/40 font-mono">
              {selectedMeta.size_kb} KB
              {selectedMeta.has_outputs && (
                <span className="ml-2 text-green-600">● Ausgaben vorhanden</span>
              )}
            </span>
          )}
          {loadingHtml && (
            <span className="ml-auto text-xs text-brand-charcoal/40 animate-pulse font-mono">Konvertiere …</span>
          )}
        </div>

        {/* iframe */}
        <div className="flex-1 relative overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-6 py-4 max-w-md">
                <p className="font-medium mb-1">Fehler beim Laden</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}

          {!error && (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title={selected}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              style={{ background: 'white' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
