import { useState, useEffect, useMemo, useCallback } from 'react'
import { DECK_META, CONTENT } from '../../content/presentation'
import { PHASES } from '../../content/phases'
import PixelPattern from '../ui/PixelPattern'
import RecordedFigure from '../walkthrough/RecordedFigure'
import AllStationsMap from '../map/AllStationsMap'
import ExplorationMapEmbed from './embeds/ExplorationMapEmbed'
import ExplorationTrendsEmbed from './embeds/ExplorationTrendsEmbed'
import DeploymentEmbed from './embeds/DeploymentEmbed'
import DeploymentCalcEmbed from './embeds/DeploymentCalcEmbed'
import PipelineDiagram from './diagrams/PipelineDiagram'
import MlpDiagram from './diagrams/MlpDiagram'
import NeuronDiagram from './diagrams/NeuronDiagram'
import BusinessCaseChart from './diagrams/BusinessCaseChart'

// Live "Switch zur Website"-Komponenten, referenziert über slide.embed.
const EMBEDS = {
  'exploration-map':    ExplorationMapEmbed,
  'exploration-trends': ExplorationTrendsEmbed,
  'deployment':         DeploymentEmbed,
  'deployment-calc':    DeploymentCalcEmbed,
}
// Inline-Diagramme (Roh-Grafiken des PDF als SVG/HTML), referenziert über slide.diagram.
const DIAGRAMS = {
  pipeline:     PipelineDiagram,
  mlp:          MlpDiagram,
  neuron:       NeuronDiagram,
  businesscase: BusinessCaseChart,
}

// Per-phase theme for the divider slides (matches each page's header colour).
const THEME = {
  business:   { bg: 'bg-brand-yellow',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-yellow' },
  data:       { bg: 'bg-brand-cyan',     text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.10)', accent: 'bg-brand-cyan' },
  prep:       { bg: 'bg-brand-yellow',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-yellow' },
  modeling:   { bg: 'bg-brand-cyan',     text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.10)', accent: 'bg-brand-cyan' },
  evaluation: { bg: 'bg-brand-orange',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-orange' },
  deployment: { bg: 'bg-brand-orange',   text: 'text-brand-charcoal', pix: 'rgba(28,28,26,0.12)', accent: 'bg-brand-orange' },
}
const phaseLabel = (key) => PHASES.find(p => p.key === key)?.label ?? ''
const phaseNum   = (key) => PHASES.find(p => p.key === key)?.n ?? ''

/** Shared slide chrome: mono date top-left, caption + page number bottom row. */
function Chrome({ caption, index, total, dark }) {
  const c = dark ? 'text-white/40' : 'text-brand-charcoal/40'
  return (
    <>
      <span className={`absolute top-6 left-8 text-[11px] font-mono uppercase tracking-widest ${c}`}>
        {DECK_META.date}
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

const BULLET = (b, i) => (
  <li key={i} className="text-lg text-brand-charcoal/85 leading-snug flex gap-3">
    <span className="text-brand-orange mt-1.5 text-xs">●</span>
    <span>{b}</span>
  </li>
)

/** Body of a content slide — picks the layout (embed/diagram/stats/code/table/…). */
function ContentBody({ slide }) {
  const bullets = slide.body?.length ? (
    <ul className="space-y-2 mb-4">{slide.body.map(BULLET)}</ul>
  ) : null

  // Live embed ("Switch zur Website")
  if (slide.embed && EMBEDS[slide.embed]) {
    const Embed = EMBEDS[slide.embed]
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {bullets}
        <div className="flex-1 flex flex-col min-h-0 overflow-auto"><Embed /></div>
      </div>
    )
  }

  // Inline diagram (PDF raw graphic as SVG/HTML)
  if (slide.diagram && DIAGRAMS[slide.diagram]) {
    const Diagram = DIAGRAMS[slide.diagram]
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {bullets}
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto"><Diagram /></div>
      </div>
    )
  }

  // All-Germany regions map
  if (slide.map) {
    return (
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {bullets}
        <div className="flex-1 min-h-[46vh]"><AllStationsMap /></div>
      </div>
    )
  }

  // Stat-card grid
  if (slide.layout === 'stats') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {bullets}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {slide.stats.map(s => (
            <div key={s.label} className="bg-white border-l-4 border-brand-orange shadow-sm p-6">
              <p className="text-4xl font-bold text-brand-charcoal">{s.value}</p>
              <p className="text-[11px] font-mono uppercase tracking-widest text-brand-charcoal/50 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Monospace block (folder tree / CV folds / CLI box)
  if (slide.layout === 'code') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {bullets}
        <pre className="bg-brand-charcoal text-brand-cream text-[13px] leading-relaxed font-mono p-5 rounded overflow-auto whitespace-pre">{slide.code}</pre>
      </div>
    )
  }

  // Table
  if (slide.layout === 'table') {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        {bullets}
        <div className="overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                {slide.table.headers.map(h => (
                  <th key={h} className="bg-brand-charcoal text-white text-sm font-semibold px-4 py-2.5 border border-brand-charcoal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.table.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 ? 'bg-white' : 'bg-brand-cream'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-2.5 border border-brand-charcoal/15 text-[15px] ${ci === 0 ? 'font-semibold text-brand-charcoal' : 'text-brand-charcoal/80'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Big centred statement
  if (slide.layout === 'statement') {
    return (
      <div className="flex-1 flex items-center">
        <p className="text-4xl md:text-5xl font-bold text-brand-charcoal leading-tight">{slide.statement}</p>
      </div>
    )
  }

  // Numbered list
  if (slide.layout === 'numbered') {
    return (
      <ol className="flex-1 space-y-5 mt-2">
        {slide.items.map((it, i) => (
          <li key={i} className="flex gap-4 text-xl text-brand-charcoal/85 leading-snug">
            <span className="font-bold text-brand-orange shrink-0">{i + 1}.</span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    )
  }

  // Figure (recorded asset) — two-column with bullets
  if (slide.figure) {
    return (
      <div className="flex-1 grid md:grid-cols-2 gap-12 items-start">
        <ul className="space-y-4">
          {slide.body?.map((b, i) => (
            <li key={i} className="text-2xl text-brand-charcoal/85 leading-snug flex gap-3">
              <span className="text-brand-orange mt-2 text-sm">●</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <RecordedFigure name={slide.figure} caption={slide.title} className="self-center" />
      </div>
    )
  }

  // Text-only
  return (
    <ul className="flex-1 space-y-4">
      {slide.body?.map((b, i) => (
        <li key={i} className="text-2xl text-brand-charcoal/85 leading-snug flex gap-3">
          <span className="text-brand-orange mt-2 text-sm">●</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PresentationMode({ open, startPhase, onClose }) {
  const [idx, setIdx] = useState(0)
  const [showDeep, setShowDeep] = useState(false)

  // PDF kennt 6 CRISP-DM-Phasen — die Reflexion-Phase der Website bleibt aus dem Deck.
  const deckPhases = useMemo(() => PHASES.filter(p => p.key !== 'reflexion'), [])

  // Build the ordered deck: title → übersicht → (divider + content) per phase → closing.
  const deck = useMemo(() => {
    const out = [{ type: 'title' }, { type: 'overview' }]
    for (const p of deckPhases) {
      out.push({ type: 'divider', phase: p.key })
      CONTENT.filter(c => c.phase === p.key).forEach(c => out.push({ type: 'content', ...c }))
    }
    out.push({ type: 'closing' })
    return out
  }, [deckPhases])

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
          {deckPhases.map(p => (
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
        <Chrome caption={`Phase ${phaseNum(slide.phase)}`} index={idx + 1} total={total} />
        <p className={`text-[12px] font-mono uppercase tracking-widest mb-3 ${t.text} opacity-60`}>
          {phaseNum(slide.phase)} · CRISP-DM
        </p>
        <h1 className={`text-6xl font-bold uppercase leading-[0.95] ${t.text}`}>{phaseLabel(slide.phase)}</h1>
      </div>
    )
  } else if (slide.type === 'closing') {
    inner = (
      <div className="relative w-full h-full bg-brand-orange overflow-hidden flex flex-col justify-center px-16">
        <PixelPattern color1="rgba(244,247,233,0.85)" color2="transparent" size={90} steps={5}
          className="absolute top-0 right-0 pointer-events-none" />
        <Chrome caption="Vielen Dank" index={idx + 1} total={total} />
        <span className="absolute top-6 right-8 text-[11px] font-mono uppercase tracking-widest text-brand-charcoal/50">
          {DECK_META.authors}
        </span>
        <h1 className="text-7xl font-bold text-brand-charcoal leading-[0.95] mb-10">Vielen Dank!</h1>
        <div className="text-xl text-brand-charcoal/80 space-y-1 relative z-10">
          <p>Daniel Feil&nbsp;&nbsp;·&nbsp;&nbsp;81116</p>
          <p>Jannis Schuler&nbsp;&nbsp;·&nbsp;&nbsp;77201</p>
        </div>
        <p className="mt-8 text-sm font-mono text-brand-charcoal/70 relative z-10">
          https://predictive-analytics.jannis-schuler.de
        </p>
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
        <h1 className="text-5xl font-bold text-brand-charcoal leading-tight mb-6">{slide.title}</h1>

        <ContentBody slide={slide} />

        {slide.deepDive && (
          <div className="mt-4 shrink-0">
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
          {deckPhases.map(p => (
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
