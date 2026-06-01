import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../services/api'
import ConfirmDialog from './ConfirmDialog'

/** Tiny code renderer — monospace with green comments (no syntax-highlight dep). */
function Code({ src }) {
  return (
    <pre className="text-[11px] leading-relaxed bg-[#1e1e1e] text-gray-200 p-3 rounded overflow-x-auto">
      {src.split('\n').map((line, i) => {
        const isComment = line.trimStart().startsWith('#')
        return (
          <div key={i} className={isComment ? 'text-green-400/80' : ''}>
            {line || ' '}
          </div>
        )
      })}
    </pre>
  )
}

function StepCard({ step }) {
  const [output, setOutput] = useState([])      // live/demo output lines
  const [figs, setFigs]       = useState(step.figures)
  const [busy, setBusy]       = useState(false)   // a run/demo is in progress
  const [mode, setMode]       = useState(null)    // 'demo' | 'live'
  const [confirm, setConfirm] = useState(false)
  const esRef    = useRef(null)
  const timerRef = useRef(null)

  // Reset when the selected step changes
  useEffect(() => {
    setOutput([]); setFigs(step.figures); setBusy(false); setMode(null)
    return () => { clearInterval(timerRef.current); esRef.current?.close() }
  }, [step.step_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Demo: typewriter-replay the recorded stdout, then reveal figures ─────────
  const runDemo = useCallback(() => {
    clearInterval(timerRef.current); esRef.current?.close()
    setMode('demo'); setBusy(true); setOutput([]); setFigs([])
    const lines = (step.recorded_stdout || '(keine Aufzeichnung vorhanden)').split('\n')
    let i = 0
    timerRef.current = setInterval(() => {
      setOutput(prev => [...prev, lines[i]])
      i += 1
      if (i >= lines.length) {
        clearInterval(timerRef.current)
        setFigs(step.figures)
        setBusy(false)
      }
    }, 45)
  }, [step])

  // ── Reload: actually re-run the step live via SSE ───────────────────────────
  const runLive = useCallback(async () => {
    clearInterval(timerRef.current); esRef.current?.close()
    setMode('live'); setBusy(true); setOutput(['$ python walkthrough_run.py ' + step.step_id])
    try {
      await api.walkthrough.run(step.step_id)
    } catch (e) {
      setOutput(prev => [...prev, '[Fehler beim Start] ' + e]); setBusy(false); return
    }
    const es = new EventSource(api.walkthrough.streamUrl())
    esRef.current = es
    es.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.status === 'connected') return
      if (m.step_id && m.step_id !== step.step_id) return
      if (m.message) setOutput(prev => [...prev, m.message])
      if (m.status === 'done' || m.status === 'error') {
        es.close(); setBusy(false)
        // cache-bust the figures so the freshly regenerated PNG shows
        setFigs(step.figures.map(u => `${u}?t=${Date.now()}`))
      }
    }
    es.onerror = () => { es.close(); setBusy(false) }
  }, [step])

  const onReload = () => {
    if (step.kind === 'heavy') setConfirm(true)
    else runLive()
  }

  return (
    <div className="space-y-3">
      <Code src={step.code} />
      {step.eli5 && (
        <p className="text-[11px] text-brand-cyan/90 border-l-2 border-brand-cyan/50 pl-2">
          <span className="font-semibold">ELI5 — </span>{step.eli5}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={runDemo}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold bg-brand-cyan text-brand-charcoal rounded hover:bg-brand-cyan/80 disabled:opacity-40"
        >
          ▶ Demo
        </button>
        <button
          onClick={onReload}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold bg-brand-orange text-white rounded hover:bg-brand-orange/90 disabled:opacity-40"
        >
          ⟳ Reload {step.kind === 'heavy' && <span className="opacity-70">(live)</span>}
        </button>
        {step.kind === 'heavy' && (
          <span className="text-[10px] text-amber-400">schwer · lädt/trainiert wirklich</span>
        )}
        {busy && <span className="text-[10px] text-gray-400 animate-pulse">läuft …</span>}
      </div>

      {/* Console */}
      {output.length > 0 && (
        <div className="bg-black/80 text-gray-200 text-[10.5px] font-mono p-2 rounded max-h-52 overflow-auto whitespace-pre-wrap">
          {output.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Figures */}
      {figs.length > 0 && (
        <div className="space-y-2">
          {figs.map((u, i) => (
            <img key={i} src={api.walkthrough.assetUrl(u)} alt="Figur"
                 className="w-full rounded border border-white/10 bg-white"
                 onError={e => { e.currentTarget.style.display = 'none' }} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`„${step.title}" wirklich live ausführen?`}
        message={'Dies lädt die echten Daten und rechnet/trainiert wirklich.\n' +
                 'Das kann von einigen Sekunden bis zu mehreren Minuten dauern.'}
        confirmLabel="Ja, live ausführen"
        onConfirm={() => { setConfirm(false); runLive() }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

export default function GuidedTerminal({ phase }) {
  const [open, setOpen]   = useState(false)
  const [steps, setSteps] = useState([])
  const [active, setActive] = useState(0)
  const [error, setError]   = useState(null)

  useEffect(() => {
    api.walkthrough.steps(phase)
      .then(r => { setSteps(r.steps || []); setActive(0) })
      .catch(e => setError(String(e)))
  }, [phase])

  if (error || steps.length === 0) {
    // Still render the tab so the layout is consistent; just no content.
  }

  return (
    <>
      {/* Left-edge tab — sits just right of the app sidebar (w-56) */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed left-56 top-1/2 -translate-y-1/2 z-[90] bg-brand-charcoal text-white text-[11px] font-mono tracking-wide px-1.5 py-3 rounded-r shadow-lg hover:bg-brand-orange transition-colors"
        style={{ writingMode: 'vertical-rl' }}
        title="Code & Terminal — der Code hinter dieser Phase"
      >
        {open ? '‹ schließen' : '› Code & Terminal'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 left-56 z-[80] bg-black/30" onClick={() => setOpen(false)} />
          <aside className="fixed left-56 top-0 bottom-0 z-[85] w-[440px] max-w-[80vw] bg-brand-charcoal text-white shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-brand-orange">Guided Terminal</p>
                <p className="text-sm font-semibold">Der Code hinter dieser Phase</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg">×</button>
            </div>

            {/* Step tabs */}
            {steps.length > 1 && (
              <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/10">
                {steps.map((s, i) => (
                  <button
                    key={s.step_id}
                    onClick={() => setActive(i)}
                    className={`px-2 py-1 text-[10px] rounded ${
                      i === active ? 'bg-brand-orange text-white' : 'bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto p-3">
              {error && <p className="text-xs text-red-300">Walkthrough nicht verfügbar: {error}</p>}
              {!error && steps[active] && (
                <>
                  <p className="text-xs font-semibold text-white/90 mb-2">{steps[active].title}</p>
                  <StepCard step={steps[active]} />
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  )
}
