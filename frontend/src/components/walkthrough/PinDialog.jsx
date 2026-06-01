import { useState, useEffect, useRef } from 'react'

/**
 * PIN unlock modal for the guided-terminal "Reload" (live script execution).
 * The PIN is verified server-side; this dialog only collects it. `error` shows
 * a server-side rejection message; `busy` disables input while verifying.
 */
export default function PinDialog({ open, error, busy, onSubmit, onCancel }) {
  const [pin, setPin] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setPin(''); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  if (!open) return null

  const submit = () => { if (pin && !busy) onSubmit(pin) }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white max-w-sm w-full mx-4 p-6 shadow-2xl border-t-4 border-brand-orange"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-brand-charcoal mb-1">Live-Ausführung entsperren</h3>
        <p className="text-sm text-gray-600 mb-4">
          „Reload" führt das echte Skript aus. Bitte PIN eingeben — sie wird serverseitig geprüft.
        </p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          disabled={busy}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="PIN"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded mb-2 font-mono tracking-widest
                     focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={!pin || busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange/90 rounded disabled:opacity-40"
          >
            {busy ? 'Prüfe …' : 'Entsperren'}
          </button>
        </div>
      </div>
    </div>
  )
}
