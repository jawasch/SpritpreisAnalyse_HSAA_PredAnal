import { useState, useEffect, useMemo, useCallback } from 'react'
import { DECK_META, CONTENT } from '../../content/presentation'
import { PHASES } from '../../content/phases'
import PixelPattern from '../ui/PixelPattern'
import RecordedFigure from '../walkthrough/RecordedFigure'

// Per-phase theme for the divider slides (matches each page's header colour).
const THEME = {
  business:   { bg: 'bg-brand-yellow',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-yellow' },
  data:       { bg: 'bg-brand-cyan',     text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.10)', accent: 'bg-brand-cyan' },
  prep:       { bg: 'bg-brand-yellow',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-yellow' },
  modeling:   { bg: 'bg-brand-cyan',     text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.10)', accent: 'bg-brand-cyan' },
  evaluation: { bg: 'bg-brand-orange',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-orange' },
  deployment: { bg: 'bg-brand-orange',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-orange' },
  reflexion:  { bg: 'bg-brand-charcoal', text: 'text-white',          pix: 'rgba(255,255,255,0.06)', accent: 'bg-brand-charcoal' },
}
const phaseLabel = (key) => PHASES.find(p => p.key === key)?.label ?? ''
const phaseNum   = (key) => PHASES.find(p => p.key === key)?.n ?? ''

/** Shared slide chrome: mono term top-left, caption + page number bottom row. */
function Chrome({ caption, index, total, dark }) {
  const c = dark ? 'text-white/40' : 'text-brand-charcoal/40'
  return (
    <>
      <span className={`absolute top-6 left-8 text-[11px] font-mono uppercase tracking-widest ${c}`}>
        {DECK_META.term}
      </span>
      <span className={`absolute bottom-5 left-8 text-[11px] font-mono uppercase tracking-widest ${c}`}>
        {caption}
      </span>
      <span className={`absolute bottom-5 right-8 text-[11px] font-mono ${c}`}>
        {index} / {total}
      </span>
    </>
  )
}

export default function PresentationMode({ open, startPhase, onClose }) {
  const [idx, setIdx] = useState(0)
  const [showDeep, setShowDeep] = useState(false)

  // Build the ordered deck: title → übersicht → (divider + content) per phase.
  const deck = useMemo(() => {
    const out = [{ type: 'title' }, { type: 'overview' }]
    for (const p of PHASES) {
      out.push({ type: 'divider', phase: p.key })
      CONTENT.filter(c => c.phase === p.key).forEach(c => out.push({ type: 'content', ...c }))
    }
    return out
  }, [])

  useEffect(() => {
    if (!open) return
    const start = deck.findIndex(s => s.type === 'divider' && s.phase === startPhase)
    setIdx(start >= 0 ? start : 0)
    setShowDeep(false)
  }, [open, startPhase, deck])

  const go = useCallback((d) => {
    setShowDeep(false)
    setIdx(i => Math.max(0, Math.min(deck.length - 1, i + d)))
  }, [deck.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key.toLowerCase() === 'd') setShowDeep(s => !s)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go, onClose])

  if (!open) return null
  const slide = deck[idx]
  const total = deck.length

  // ── Slide renderers ──────────────────────────────────────────────────────────
  let inner = null

  if (slide.type === 'title') {
    inner = (
      <div className="relative w-full h-full bg-brand-orange overflow-hidden flex flex-col justify-center px-16">
        <PixelPattern color1="rgba(244,247,233,0.85)" color2="transparent" size={90} steps={5}
          className="absolute top-0 right-0 pointer-events-none" />
        <Chrome caption={DECK_META.subtitle} index={idx + 1} total={total} />
        <span className="absolute top-6 right-8 text-[11px] font-mono uppercase tracking-widest text-brand-charcoal/50">
          {DECK_META.authors}
        </span>
        <p className="text-[12px] font-mono uppercase tracking-widest text-brand-charcoal/60 mb-4">MLP Regressor</p>
        <h1 className="text-7xl font-bold text-brand-charcoal leading-[0.95]">{DECK_META.title1}</h1>
        <h1 className="text-7xl font-bold text-brand-charcoal leading-[0.95]">{DECK_META.title2}</h1>
      </div>
    )
  } else if (slide.type === 'overview') {
    inner = (
      <div className="relative w-full h-full bg-brand-cream overflow-hidden flex flex-col justify-center px-16">
        <PixelPattern color1="rgba(6,182,212,0.9)" color2="transparent" size={90} steps={5}
          className="absolute top-0 right-0 pointer-events-none" />
        <Chrome caption="Die Übersicht" index={idx + 1} total={total} />
        <div className="space-y-3 relative z-10">
          {PHASES.map(p => (
            <p key={p.key} className="text-3xl font-bold text-brand-charcoal uppercase tracking-tight">{p.label}</p>
          ))}
        </div>
      </div>
    )
  } else if (slide.type === 'divider') {
    const t = THEME[slide.phase]
    inner = (
      <div className={`relative w-full h-full ${t.bg} overflow-hidden flex flex-col justify-center px-16`}>
        <PixelPattern color1={t.pix} color2="transparent" size={90} steps={5}
          className="absolute bottom-0 right-0 pointer-events-none" />
        <Chrome caption={`Phase ${phaseNum(slide.phase)}`} index={idx + 1} total={total} dark={slide.phase === 'reflexion'} />
        <p className={`text-[12px] font-mono uppercase tracking-widest mb-3 ${t.text} opacity-60`}>
          {phaseNum(slide.phase)} · CRISP-DM
        </p>
        <h1 className={`text-6xl font-bold uppercase leading-[0.95] ${t.text}`}>{phaseLabel(slide.phase)}</h1>
      </div>
    )
  } else {
    // content
    const t = THEME[slide.phase]
    inner = (
      <div className="relative w-full h-full bg-brand-cream overflow-hidden flex flex-col px-16 pt-16 pb-14">
        <Chrome caption={phaseLabel(slide.phase)} index={idx + 1} total={total} />
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-xs font-mono px-2 py-0.5 ${t.accent} text-brand-charcoal`}>{phaseNum(slide.phase)}</span>
          <span className="text-xs bg-brand-charcoal text-white rounded-full px-3 py-0.5 font-medium">{slide.author}</span>
        </div>
        <h1 className="text-5xl font-bold text-brand-charcoal leading-tight mb-8">{slide.title}</h1>

        <div className={`flex-1 grid ${slide.figure ? 'md:grid-cols-2 gap-12' : 'grid-cols-1'} items-start`}>
          <ul className="space-y-4">
            {slide.body.map((b, i) => (
              <li key={i} className="text-2xl text-brand-charcoal/85 leading-snug flex gap-3">
                <span className="text-brand-orange mt-2 text-sm">●</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {slide.figure && (
            <RecordedFigure name={slide.figure} caption={slide.title} className="self-center" />
          )}
        </div>

        {slide.deepDive && (
          <div className="mt-6">
            <button onClick={() => setShowDeep(s => !s)}
              className="text-sm font-semibold text-brand-charcoal/70 hover:text-brand-orange">
              {showDeep ? '▾' : '▸'} Deep Dive — {slide.deepDive.label} <span className="text-brand-charcoal/30 text-xs">(D)</span>
            </button>
            {showDeep && (
              <p className="mt-2 text-base text-brand-charcoal/70 leading-relaxed border-l-2 border-brand-orange/50 pl-4 max-w-3xl">
                {slide.deepDive.text}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  const activePhase = slide.phase

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* top control bar */}
      <div className="absolute top-4 right-6 z-[210] flex items-center gap-4">
        <button onClick={onClose} className="text-white/70 hover:text-white text-sm font-mono">✕ ESC</button>
      </div>

      {/* slide */}
      <div className="flex-1 relative">{inner}</div>

      {/* bottom nav */}
      <div className="h-14 bg-brand-charcoal flex items-center justify-between px-8 shrink-0">
        <button onClick={() => go(-1)} disabled={idx === 0}
          className="px-4 py-1.5 text-sm bg-white/10 text-white rounded hover:bg-white/20 disabled:opacity-30">← zurück</button>
        <div className="flex items-center gap-2">
          {PHASES.map(p => (
            <div key={p.key} title={p.label}
              className={`h-1.5 rounded-full transition-all ${p.key === activePhase ? 'w-8 bg-brand-orange' : 'w-3 bg-white/25'}`} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={idx === total - 1}
          className="px-4 py-1.5 text-sm bg-brand-orange text-white rounded hover:bg-brand-orange/90 disabled:opacity-30">weiter →</button>
      </div>
    </div>
  )
}
