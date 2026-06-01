import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function PickAccuracyChart({
  data,
  yKey = 'accuracy',
  yLabel = 'Pick-Accuracy',
  referenceValue = 0.20,
  referenceLabel = 'Zufallsbasis (20%)',
  formatY = (v) => `${(v * 100).toFixed(0)} %`,
  height = 220,
}) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 600
    const H = height
    const margin = { top: 16, right: 24, bottom: 36, left: 56 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom

    const yValues = data.map((d) => d[yKey])
    const yMin = Math.min(...yValues, referenceValue)
    const yMax = Math.max(...yValues, referenceValue)
    const yPad = (yMax - yMin) * 0.2 || 0.02
    const xExtent = d3.extent(data, (d) => d.horizon_h)

    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerW])
    const yScale = d3.scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([innerH, 0])
      .nice()

    const lineGen = d3.line()
      .x((d) => xScale(d.horizon_h))
      .y((d) => yScale(d[yKey]))
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
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(formatY))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(referenceValue)).attr('y2', yScale(referenceValue))
      .attr('stroke', '#d1d5db').attr('stroke-dasharray', '6,3').attr('stroke-width', 1.5)

    g.append('text')
      .attr('x', innerW - 4).attr('y', yScale(referenceValue) - 4)
      .attr('fill', '#9ca3af').attr('font-size', 10).attr('text-anchor', 'end')
      .text(referenceLabel)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen)

    g.selectAll('.dot')
      .data(data)
      .join('circle')
      .attr('r', 4)
      .attr('cx', (d) => xScale(d.horizon_h))
      .attr('cy', (d) => yScale(d[yKey]))
      .attr('fill', '#3b82f6')

    g.append('text')
      .attr('x', -innerH / 2).attr('y', -44)
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#9ca3af').attr('font-size', 10).attr('text-anchor', 'middle')
      .text(yLabel)

    const tooltip = d3.select('body')
      .selectAll('.pick-acc-tt')
      .data([null])
      .join('div')
      .attr('class', 'pick-acc-tt')
      .style('position', 'fixed')
      .style('background', 'rgba(17,24,39,0.92)')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    g.selectAll('.dot-overlay')
      .data(data)
      .join('circle')
      .attr('r', 8)
      .attr('cx', (d) => xScale(d.horizon_h))
      .attr('cy', (d) => yScale(d[yKey]))
      .attr('fill', 'transparent')
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1)
          .style('left', event.clientX + 12 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .html(`+${d.horizon_h}h: <b>${formatY(d[yKey])}</b>`)
      })
      .on('mouseleave', () => tooltip.style('opacity', 0))

    return () => {
      svg.selectAll('*').remove()
      d3.selectAll('.pick-acc-tt').remove()
    }
  }, [data, yKey, yLabel, referenceValue, referenceLabel, formatY, height])

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg ref={svgRef} />
    </div>
  )
}
