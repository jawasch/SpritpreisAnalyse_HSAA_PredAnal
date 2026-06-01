export default function Eli5({ title, children, className = '' }) {
  return (
    <div className={`bg-brand-charcoal border-l-4 border-brand-orange p-4 ${className}`}>
      {title && (
        <p className="text-[10px] font-mono font-semibold text-brand-orange uppercase tracking-widest mb-2">
          ELI5 — {title}
        </p>
      )}
      <p className="text-sm text-white/80 leading-relaxed">{children}</p>
    </div>
  )
}
