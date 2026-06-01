export default function PixelPattern({
  color1 = 'rgba(28,28,26,0.15)',
  color2 = 'transparent',
  size   = 36,
  steps  = 4,
  flip   = false,
  className = '',
}) {
  const rects = []
  for (let row = 0; row < steps; row++) {
    const colCount = row + 1
    const startX   = (steps - colCount) * size
    for (let col = 0; col < colCount; col++) {
      const fill = (row + col) % 2 === 0 ? color1 : color2
      rects.push(
        <rect
          key={`${row}-${col}`}
          x={startX + col * size}
          y={row * size}
          width={size}
          height={size}
          fill={fill}
        />
      )
    }
  }
  const w = steps * size
  return (
    <svg
      width={w}
      height={w}
      viewBox={`0 0 ${w} ${w}`}
      className={className}
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      {rects}
    </svg>
  )
}
