/** Multi-Layer Perceptron (PDF S.17) — input → hidden → output, fully connected. */
export default function MlpDiagram() {
  const W = 900, H = 460
  const cols = {
    input:  { x: 150, color: '#06b6d4', nodes: [
      { y: 90, label: 't' }, { y: 200, label: 't−1h' }, { y: 300, label: '…' }, { y: 390, label: 'Rolling_mean' },
    ] },
    hidden: { x: 450, color: '#f59e0b', nodes: [
      { y: 110, label: '' }, { y: 230, label: '…' }, { y: 360, label: '' },
    ] },
    output: { x: 750, color: '#f97316', nodes: [
      { y: 90, label: 'Station_1 · t+1h' }, { y: 200, label: 'Station_2 · t+2h' }, { y: 300, label: '…' }, { y: 390, label: 'Station_5 · t+72h' },
    ] },
  }
  const r = 34
  const edges = []
  cols.input.nodes.forEach((a, i) =>
    cols.hidden.nodes.forEach((b, j) => edges.push({ k: `ih${i}${j}`, x1: cols.input.x, y1: a.y, x2: cols.hidden.x, y2: b.y })))
  cols.hidden.nodes.forEach((a, i) =>
    cols.output.nodes.forEach((b, j) => edges.push({ k: `ho${i}${j}`, x1: cols.hidden.x, y1: a.y, x2: cols.output.x, y2: b.y })))

  const Layer = ({ col, title }) => (
    <g>
      <text x={col.x} y={28} textAnchor="middle" className="fill-brand-charcoal" fontSize="18" fontWeight="700">{title}</text>
      {col.nodes.map((n, i) => (
        <g key={i}>
          <circle cx={col.x} cy={n.y} r={r} fill="white" stroke={col.color} strokeWidth="3" />
          <text x={col.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="12" className="fill-brand-charcoal">{n.label}</text>
        </g>
      ))}
    </g>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      {edges.map(e => (
        <line key={e.k} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#1c1c1a" strokeOpacity="0.18" strokeWidth="1" />
      ))}
      <Layer col={cols.input}  title="Input-Layer" />
      <Layer col={cols.hidden} title="Hidden Layer (32)" />
      <Layer col={cols.output} title="Output-Layer (360)" />
    </svg>
  )
}
