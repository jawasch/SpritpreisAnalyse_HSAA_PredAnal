/** Single neuron (PDF S.18) — weighted sum (Σ with limits, before the term) →
 *  ReLU → output, plus a small ReLU activation plot. */
export default function NeuronDiagram() {
  const inputs = [
    { y: 70,  label: '1',   w: 'b' },
    { y: 150, label: 'x₁',  w: 'ω₁' },
    { y: 230, label: 'x₂',  w: 'ω₂' },
    { y: 305, label: '…',   w: '' },
    { y: 380, label: 'xₙ',  w: 'ωₙ' },
  ]
  const inX = 110, inR = 28
  const sumX = 380, sumY = 240, sumR = 62
  const reluX = 600, reluY = 240, reluR = 46
  const outX = 780, outY = 240, outR = 40

  // Mini ReLU plot box (top-right)
  const px0 = 560, px1 = 884, py0 = 28, py1 = 150
  const ax = px0 + 46          // y-axis x-position
  const axBottom = py1 - 14    // x-axis y-position (f=0 baseline)
  const axTop = py0 + 6

  return (
    <svg viewBox="0 0 900 460" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      <defs>
        <marker id="nrn-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#1c1c1a" />
        </marker>
      </defs>

      {/* inputs → sum */}
      {inputs.map((n, i) => (
        <g key={i}>
          <line x1={inX + inR} y1={n.y} x2={sumX - sumR} y2={sumY} stroke="#1c1c1a" strokeOpacity="0.4" strokeWidth="1.5" />
          <circle cx={inX} cy={n.y} r={inR} fill="white" stroke="#06b6d4" strokeWidth="3" />
          <text x={inX} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="16" className="fill-brand-charcoal">{n.label}</text>
          {n.w && (
            <text x={(inX + inR + sumX - sumR) / 2} y={(n.y + sumY) / 2 - 6} textAnchor="middle" fontSize="15" fontStyle="italic" className="fill-brand-charcoal">{n.w}</text>
          )}
        </g>
      ))}

      {/* sum node: Σ with n above, i=1 below, term ωᵢxᵢ to the right */}
      <circle cx={sumX} cy={sumY} r={sumR} fill="white" stroke="#1c1c1a" strokeWidth="2" />
      <text x={sumX - 16} y={sumY - 30} textAnchor="middle" fontSize="13" className="fill-brand-charcoal">n</text>
      <text x={sumX - 16} y={sumY + 8} textAnchor="middle" fontSize="42" className="fill-brand-charcoal" style={{ fontFamily: 'serif' }}>Σ</text>
      <text x={sumX - 16} y={sumY + 34} textAnchor="middle" fontSize="12" className="fill-brand-charcoal">i=1</text>
      <text x={sumX + 16} y={sumY + 6} textAnchor="middle" fontSize="18" fontStyle="italic" className="fill-brand-charcoal">ωᵢxᵢ</text>

      {/* sum → ReLU → y */}
      <line x1={sumX + sumR} y1={sumY} x2={reluX - reluR - 4} y2={reluY} stroke="#1c1c1a" strokeWidth="2" markerEnd="url(#nrn-arrow)" />
      <circle cx={reluX} cy={reluY} r={reluR} fill="white" stroke="#1c1c1a" strokeWidth="2" />
      <text x={reluX} y={reluY} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontStyle="italic" className="fill-brand-charcoal">ReLU</text>
      <line x1={reluX + reluR} y1={reluY} x2={outX - outR - 4} y2={outY} stroke="#1c1c1a" strokeWidth="2" markerEnd="url(#nrn-arrow)" />
      <circle cx={outX} cy={outY} r={outR} fill="white" stroke="#1c1c1a" strokeWidth="2" />
      <text x={outX} y={outY} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontStyle="italic" className="fill-brand-charcoal">y</text>

      {/* mini ReLU activation plot (top-right) */}
      <text x={(px0 + px1) / 2} y={py0 - 4} textAnchor="middle" fontSize="12" className="fill-brand-charcoal/70">ReLU-Aktivierung · f(x) = max(0, x)</text>
      <line x1={ax} y1={axTop} x2={ax} y2={py1} stroke="#9ca3af" strokeWidth="1" />
      <line x1={px0} y1={axBottom} x2={px1} y2={axBottom} stroke="#9ca3af" strokeWidth="1" />
      <line x1={px0 + 6} y1={axBottom} x2={ax} y2={axBottom} stroke="#3b82f6" strokeWidth="2.5" />
      <line x1={ax} y1={axBottom} x2={px1 - 6} y2={axTop} stroke="#3b82f6" strokeWidth="2.5" />
      <text x={px1 - 40} y={axTop + 14} fontSize="10" className="fill-brand-charcoal/60">Steigung 1</text>
    </svg>
  )
}
