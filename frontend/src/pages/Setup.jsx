import { useState, useEffect, useRef } from 'react'

const STATUS_META = {
  ok:                { icon: '✅', color: 'text-green-600', bg: 'bg-green-50',  label: 'Vorhanden'         },
  missing:           { icon: '○',  color: 'text-gray-400',  bg: 'bg-gray-50',   label: 'Fehlt'             },
  running:           { icon: '⟳',  color: 'text-blue-600',  bg: 'bg-blue-50',   label: 'Wird erstellt…'    },
  pending:           { icon: '○',  color: 'text-gray-300',  bg: 'bg-gray-50',   label: 'Wartend'           },
  done:              { icon: '✅', color: 'text-green-600', bg: 'bg-green-50',  label: 'Fertig'            },
  error:             { icon: '❌', color: 'text-red-600',   bg: 'bg-red-50',    label: 'Fehler'            },
  notebook_required: { icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50',  label: 'Notebook nötig'    },
  data_missing:      { icon: '📂', color: 'text-orange-600', bg: 'bg-orange-50', label: 'Rohdaten fehlen'  },
}

function ComponentRow({ comp, runStatus }) {
  const live = runStatus[comp.id]
  const status = live?.status ?? comp.status
  const meta = STATUS_META[status] ?? STATUS_META.missing
  const isRunning = status === 'running'

  return (
    <div className={`rounded-lg border p-3 transition-all ${meta.bg} ${
      isRunning ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
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
          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${live.progress ?? 0}%` }}
            />
          </div>
          {live.message && (
            <p className="text-[10px] text-blue-600 mt-1 truncate">{live.message}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔧</span>
            <h1 className="text-xl font-bold text-gray-900">Spritpreis Analytics — Setup</h1>
          </div>
          <p className="text-sm text-gray-500">
            Prüft und erstellt fehlende Daten, Parquets und Modell-Artefakte.
            Notebooks müssen weiterhin manuell ausgeführt werden.
          </p>
          {!loading && (
            <div className="mt-2 flex gap-3 text-xs flex-wrap">
              <span className="text-green-600 font-medium">
                ✅ {components.filter(c => c.status === 'ok').length} vorhanden
              </span>
              {scriptableCount > 0 && (
                <span className="text-blue-600 font-medium">
                  ○ {scriptableCount} buildbar
                </span>
              )}
              <span className="text-amber-600 font-medium">
                ⚠️ {components.filter(c => c.status === 'notebook_required').length} brauchen Notebook
              </span>
              {dataMissingCount > 0 && (
                <span className="text-orange-600 font-medium">
                  📂 {dataMissingCount} Rohdaten fehlen
                </span>
              )}
            </div>
          )}
        </div>

        {/* Component list */}
        <div className="flex-1 overflow-auto p-5 space-y-2.5">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Lade Status …</div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            components.map(comp => (
              <ComponentRow key={comp.id} comp={comp} runStatus={runStatus} />
            ))
          )}

          {allDone && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-semibold text-sm">
                ✅ Alle Komponenten bereit — die App kann gestartet werden!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">
            {running && (
              <span className="text-blue-600 animate-pulse font-medium">
                ⟳ Setup läuft …
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onDone?.()}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Überspringen →
            </button>
            {scriptableCount > 0 && !running && (
              <button
                onClick={handleRunAll}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                ▶ Fehlende Daten aufbauen ({scriptableCount})
              </button>
            )}
            {allDone && (
              <button
                onClick={() => onDone?.()}
                className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
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
