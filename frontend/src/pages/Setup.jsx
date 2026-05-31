import { useState, useEffect, useRef } from 'react'
import PixelPattern from '../components/ui/PixelPattern'

const STATUS_META = {
  ok:                { icon: '✅', color: 'text-green-600',       bg: 'bg-green-50 border-green-200',         label: 'Vorhanden'      },
  missing:           { icon: '○',  color: 'text-brand-charcoal/40', bg: 'bg-white border-brand-charcoal/15',   label: 'Fehlt'          },
  running:           { icon: '⟳',  color: 'text-brand-cyan',       bg: 'bg-brand-cyan/10 border-brand-cyan/40',label: 'Wird erstellt…' },
  pending:           { icon: '○',  color: 'text-brand-charcoal/20', bg: 'bg-white border-brand-charcoal/10',   label: 'Wartend'        },
  done:              { icon: '✅', color: 'text-green-600',       bg: 'bg-green-50 border-green-200',         label: 'Fertig'         },
  error:             { icon: '❌', color: 'text-red-600',         bg: 'bg-red-50 border-red-200',             label: 'Fehler'         },
  notebook_required: { icon: '⚠️', color: 'text-brand-yellow',    bg: 'bg-brand-yellow/20 border-brand-yellow/50', label: 'Notebook nötig' },
  data_missing:      { icon: '📂', color: 'text-brand-orange',    bg: 'bg-brand-orange/10 border-brand-orange/30', label: 'Rohdaten fehlen'},
}

function ComponentRow({ comp, runStatus }) {
  const live = runStatus[comp.id]
  const status = live?.status ?? comp.status
  const meta = STATUS_META[status] ?? STATUS_META.missing
  const isRunning = status === 'running'

  return (
    <div className={`border p-3 transition-all ${meta.bg} ${
      isRunning ? 'ring-1 ring-brand-cyan/40' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-lg shrink-0 ${isRunning ? 'animate-spin' : ''}`}>
            {isRunning ? '⟳' : meta.icon}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${meta.color}`}>{comp.label}</p>
            <p className="text-xs text-gray-500 truncate">{comp.description}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
          {comp.status === 'ok' && comp.size_kb && (
            <p className="text-[10px] text-gray-400">{comp.size_kb} KB</p>
          )}
          {comp.status === 'ok' && comp.mtime && (
            <p className="text-[10px] text-gray-400">{comp.mtime}</p>
          )}
          {comp.notebook_required && comp.status !== 'ok' && comp.notebook && (
            <p className="text-[10px] text-amber-500 mt-0.5">
              Notebook: {comp.notebook}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && live && (
        <div className="mt-2">
          <div className="h-1.5 bg-brand-cyan/20 overflow-hidden">
            <div
              className="h-full bg-brand-cyan transition-all duration-300"
              style={{ width: `${live.progress ?? 0}%` }}
            />
          </div>
          {live.message && (
            <p className="text-[10px] text-brand-charcoal/60 mt-1 truncate font-mono">{live.message}</p>
          )}
        </div>
      )}

      {/* Error message from script output */}
      {status === 'error' && live?.message && (
        <p className="text-xs text-red-600 mt-1.5 bg-red-100 rounded px-2 py-1 whitespace-pre-wrap">
          {live.message}
        </p>
      )}

      {/* data_missing: show the hint from the backend pre-check */}
      {status === 'data_missing' && comp.hint && (
        <p className="text-xs text-orange-700 mt-1.5 bg-orange-100 rounded px-2 py-1 whitespace-pre-wrap">
          {comp.hint}
        </p>
      )}
    </div>
  )
}

export default function Setup({ onDone }) {
  const [components, setComponents] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [running,    setRunning]    = useState(false)
  const [runStatus,  setRunStatus]  = useState({})   // {id: {status, progress, message}}
  const [allDone,    setAllDone]    = useState(false)
  const [error,      setError]      = useState(null)
  const esRef = useRef(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/setup/status')
      const data = await res.json()
      setComponents(data.components || [])
      setAllDone(data.all_ready || false)
    } catch (e) {
      setError('Backend nicht erreichbar. Ist docker-compose up gelaufen?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const connectSSE = () => {
    if (esRef.current) esRef.current.close()
    const es = new EventSource('/api/v1/setup/stream')
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.component === '__all__' && msg.status === 'done') {
          setRunning(false)
          setAllDone(true)
          es.close()
          fetchStatus()   // refresh component list with final statuses
          return
        }
        if (msg.component === '__status__') return

        setRunStatus(prev => ({
          ...prev,
          [msg.component]: { status: msg.status, progress: msg.progress, message: msg.message },
        }))
      } catch {}
    }
    es.onerror = () => { es.close(); setRunning(false) }
  }

  const handleRunAll = async () => {
    setRunning(true)
    setRunStatus({})
    connectSSE()
    try {
      await fetch('/api/v1/setup/run-all', { method: 'POST' })
    } catch (e) {
      setError('Fehler beim Starten des Setups.')
      setRunning(false)
    }
  }

  const scriptableCount = components.filter(
    c => c.status === 'missing' && c.script
  ).length

  const dataMissingCount = components.filter(c => c.status === 'data_missing').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-charcoal/85 backdrop-blur-sm p-4">
      <div className="bg-brand-cream shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="relative overflow-hidden bg-brand-charcoal px-6 py-5 shrink-0">
          <PixelPattern color1="rgba(255,255,255,0.07)" color2="transparent" size={28} steps={4}
            className="absolute top-0 right-0" />
          <div className="flex items-center gap-3 mb-1 relative z-10">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Setup · Spritpreis Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase leading-none relative z-10">Daten-Setup</h1>
          <p className="text-xs text-white/50 mt-1.5 relative z-10">
            Prüft und erstellt fehlende Daten, Parquets und Modell-Artefakte.
            Notebooks müssen weiterhin manuell ausgeführt werden.
          </p>
          {!loading && (
            <div className="mt-3 flex gap-3 text-xs flex-wrap relative z-10">
              <span className="text-green-400 font-medium">
                ✅ {components.filter(c => c.status === 'ok').length} vorhanden
              </span>
              {scriptableCount > 0 && (
                <span className="text-brand-cyan font-medium">
                  ○ {scriptableCount} buildbar
                </span>
              )}
              <span className="text-brand-yellow font-medium">
                ⚠️ {components.filter(c => c.status === 'notebook_required').length} brauchen Notebook
              </span>
              {dataMissingCount > 0 && (
                <span className="text-brand-orange font-medium">
                  📂 {dataMissingCount} Rohdaten fehlen
                </span>
              )}
            </div>
          )}
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-auto p-5 space-y-2">
          {loading ? (
            <div className="text-center py-10 text-brand-charcoal/40 font-mono text-sm">Lade Status …</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            components.map(comp => (
              <ComponentRow key={comp.id} comp={comp} runStatus={runStatus} />
            ))
          )}

          {allDone && (
            <div className="bg-green-50 border border-green-300 p-4 text-center">
              <p className="text-green-700 font-bold text-sm uppercase tracking-wide">
                ✅ Alle Komponenten bereit — die App kann gestartet werden!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-charcoal/10 bg-brand-cream shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-brand-charcoal/40 font-mono">
            {running && (
              <span className="text-brand-cyan animate-pulse font-medium">
                ⟳ Setup läuft …
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onDone?.()}
              className="px-4 py-2 text-sm text-brand-charcoal/50 hover:text-brand-charcoal transition-colors"
            >
              Überspringen →
            </button>
            {scriptableCount > 0 && !running && (
              <button
                onClick={handleRunAll}
                className="px-5 py-2 text-sm font-bold bg-brand-orange text-white hover:brightness-110 transition-all uppercase tracking-wide"
              >
                ▶ Fehlende Daten aufbauen ({scriptableCount})
              </button>
            )}
            {allDone && (
              <button
                onClick={() => onDone?.()}
                className="px-5 py-2 text-sm font-bold bg-green-600 text-white hover:brightness-110 transition-all uppercase tracking-wide"
              >
                ✅ Zur App →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
