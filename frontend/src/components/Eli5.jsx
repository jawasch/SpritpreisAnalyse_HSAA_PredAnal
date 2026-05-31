export default function Eli5({ title, children, className = '' }) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-2">
        <span className="text-blue-500 text-lg shrink-0 mt-0.5">💡</span>
        <div>
          {title && (
            <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
              ELI5 — {title}
            </p>
          )}
          <p className="text-sm text-blue-800 leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  )
}
