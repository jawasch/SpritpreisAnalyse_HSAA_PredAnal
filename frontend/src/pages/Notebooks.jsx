import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'

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
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Notebooks</h2>
          <p className="text-xs text-gray-400 mt-0.5">Analyseergebnisse</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {loadingList && (
            <p className="text-xs text-gray-400 px-2 py-4 text-center">Lade …</p>
          )}
          {!loadingList && notebooks.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-4 text-center">
              Keine Notebooks gefunden
            </p>
          )}
          {notebooks.map(nb => (
            <button
              key={nb.name}
              onClick={() => setSelected(nb.name)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selected === nb.name
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-medium leading-snug">
                  {nb.display_name}
                </span>
                {nb.has_outputs && (
                  <span className="shrink-0 mt-0.5 inline-block w-2 h-2 rounded-full bg-green-400" title="Hat Ausgaben" />
                )}
              </div>
              <span className="text-xs text-gray-400">{nb.size_kb} KB</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right panel — rendered notebook */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Notebook header bar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium text-gray-800">
            {selectedMeta?.display_name ?? selected}
          </span>
          {selectedMeta && (
            <span className="text-xs text-gray-400">
              {selectedMeta.size_kb} KB
              {selectedMeta.has_outputs && (
                <span className="ml-2 text-green-600">● Ausgaben vorhanden</span>
              )}
            </span>
          )}
          {loadingHtml && (
            <span className="ml-auto text-xs text-gray-400 animate-pulse">Konvertiere …</span>
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
