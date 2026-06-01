/**
 * Small modal confirmation — used to gate "heavy" Reload actions
 * (loading data / training a model) so they never fire by accident.
 */
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Ja, ausführen', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white max-w-md w-full mx-4 p-6 shadow-2xl border-t-4 border-brand-orange"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-brand-charcoal mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange/90 rounded"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
