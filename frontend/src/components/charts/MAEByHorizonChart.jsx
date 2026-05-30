import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function MAEByHorizonChart({ data, height = 220 }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 600
    const H = height
    const margin = { top: 24, right: 24, bottom: 36, left: 56 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom

    const allValues = data.flatMap((d) => [d.mlp_mae, d.baseline_mae])
    const yExtent = d3.extent(allValues)
    const yPad = (yExtent[1] - yExtent[0]) * 0.25 || 0.002
    const xExtent = d3.extent(data, (d) => d.horizon_h)

    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerW])
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])
      .nice()

    const mlpLine = d3.line()
      .x((d) => xScale(d.horizon_h)).y((d) => yScale(d.mlp_mae))
      .curve(d3.curveMonotoneX)
    const baseLine = d3.line()
      .x((d) => xScale(d.horizon_h)).y((d) => yScale(d.baseline_mae))
      .curve(d3.curveMonotoneX)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(5))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#f0f0f0'))

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => `${d}h`))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => d.toFixed(3)))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('path')
      .datum(data)
      .attr('fill', 'none').attr('stroke', '#9ca3af').attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3').attr('d', baseLine)

    g.append('path')
      .datum(data)
      .attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2.5)
      .attr('d', mlpLine)

    const legendItems = [
      { label: 'MLP [256,128]', color: '#3b82f6', dash: null },
      { label: 'Persistence Baseline', color: '#9ca3af', dash: '6,3' },
    ]
    const lx = Math.max(0, innerW - 170)
    legendItems.forEach((item, i) => {
      const lg = g.append('g').attr('transform', `translate(${lx},${i * 18})`)
      lg.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 7).attr('y2', 7)
        .attr('stroke', item.color).attr('stroke-width', 2)
        .attr('stroke-dasharray', item.dash || '')
      lg.append('text').attr('x', 22).attr('y', 11)
        .attr('fill', '#374151').attr('font-size', 11).text(item.label)
    })

    g.append('text')
      .attr('x', -innerH / 2).attr('y', -44)
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#9ca3af').attr('font-size', 10).attr('text-anchor', 'middle')
      .text('MAE (EUR/L)')

    return () => svg.selectAll('*').remove()
  }, [data, height])

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg ref={svgRef} />
    </div>
  )
}
