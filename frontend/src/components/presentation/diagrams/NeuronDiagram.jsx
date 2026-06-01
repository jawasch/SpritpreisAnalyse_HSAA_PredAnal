/** Single neuron (PDF S.18) — weighted sum → ReLU → output, with a ReLU inset. */
export default function NeuronDiagram() {
  const inputs = [
    { y: 70,  label: '1',   w: 'b' },
    { y: 150, label: 'x₁',  w: 'ω₁' },
    { y: 230, label: 'x₂',  w: 'ω₂' },
    { y: 300, label: '…',   w: '' },
    { y: 370, label: 'xₙ',  w: 'ωₙ' },
  ]
  const sumX = 360, sumY = 220, reluX = 560, outX = 760

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <svg viewBox="0 0 880 440" className="w-full flex-1">
        {inputs.map((n, i) => (
          <g key={i}>
            <line x1={150} y1={n.y} x2={sumX} y2={sumY} stroke="#1c1c1a" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx={110} cy={n.y} r={28} fill="white" stroke="#06b6d4" strokeWidth="3" />
            <text x={110} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="15" className="fill-brand-charcoal">{n.label}</text>
            {n.w && <text x={245} y={(n.y + sumY) / 2 - 6} textAnchor="middle" fontSize="14" fontStyle="italic" className="fill-brand-charcoal">{n.w}</text>}
          </g>
        ))}
        {/* Sum node */}
        <circle cx={sumX} cy={sumY} r={46} fill="white" stroke="#1c1c1a" strokeWidth="2" />
        <text x={sumX} y={sumY - 4} textAnchor="middle" fontSize="26" className="fill-brand-charcoal">Σ</text>
        <text x={sumX} y={sumY + 22} textAnchor="middle" fontSize="12" className="fill-brand-charcoal">ωᵢxᵢ</text>
        <line x1={sumX + 46} y1={sumY} x2={reluX - 46} y2={sumY} stroke="#1c1c1a" strokeWidth="2" markerEnd="url(#arrow)" />
        {/* ReLU node */}
        <circle cx={reluX} cy={sumY} r={46} fill="white" stroke="#1c1c1a" strokeWidth="2" />
        <text x={reluX} y={sumY} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontStyle="italic" className="fill-brand-charcoal">ReLU</text>
        <line x1={reluX + 46} y1={sumY} x2={outX - 40} y2={sumY} stroke="#1c1c1a" strokeWidth="2" markerEnd="url(#arrow)" />
        {/* Output */}
        <circle cx={outX} cy={sumY} r={40} fill="white" stroke="#1c1c1a" strokeWidth="2" />
        <text x={outX} y={sumY} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontStyle="italic" className="fill-brand-charcoal">y</text>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#1c1c1a" />
          </marker>
        </defs>
      </svg>
      <p className="text-center text-sm text-brand-charcoal/70 font-mono shrink-0">
        ReLU-Aktivierung: f(x) = max(0, x) — Steigung 1 für x &gt; 0, sonst 0
      </p>
    </div>
  )
}
