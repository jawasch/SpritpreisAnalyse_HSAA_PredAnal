import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { WEEKDAY_LABELS } from '../../services/api'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}`)

export default function TimeHeatmap({ data, overallAvg }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 700
    const margin = { top: 24, right: 60, bottom: 40, left: 36 }
    const innerW = W - margin.left - margin.right
    const cellW = innerW / 24
    const cellH = 32
    const innerH = cellH * 7
    const H = innerH + margin.top + margin.bottom

    const minVal = d3.min(data, (d) => d.avg_price)
    const maxVal = d3.max(data, (d) => d.avg_price)

    const colorScale = d3.scaleSequential()
      .domain([minVal, maxVal])
      .interpolator(d3.interpolateRgb('#22c55e', '#ef4444'))

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Cells
    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', (d) => d.hour * cellW)
      .attr('y', (d) => d.weekday * cellH)
      .attr('width', cellW - 1)
      .attr('height', cellH - 1)
      .attr('rx', 2)
      .attr('fill', (d) => colorScale(d.avg_price))
      .attr('opacity', 0.85)

    // Hour axis (bottom)
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(d3.scaleBand().domain(HOUR_LABELS).range([0, innerW]))
          .tickSize(0)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax.selectAll('text')
          .attr('fill', '#9ca3af')
          .attr('font-size', 9)
          .attr('dy', '1em')
      )

    // Weekday axis (left)
    g.append('g')
      .call(
        d3.axisLeft(d3.scaleBand().domain(WEEKDAY_LABELS).range([0, innerH]))
          .tickSize(0)
      )
      .call((ax) => ax.select('.domain').remove())
      .call((ax) =>
        ax.selectAll('text')
          .attr('fill', '#6b7280')
          .attr('font-size', 11)
          .attr('dx', '-4px')
      )

    // Color legend
    const legendW = 120
    const legendX = innerW + 12
    const legendGrad = svg.append('defs').append('linearGradient')
      .attr('id', 'heatmap-legend')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%')
    legendGrad.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e')
    legendGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444')

    const lg = svg.append('g').attr('transform', `translate(${margin.left + legendX},${margin.top})`)
    lg.append('rect')
      .attr('width', 10)
      .attr('height', innerH)
      .attr('fill', 'url(#heatmap-legend)')
      .attr('rx', 2)
    lg.append('text').attr('x', 14).attr('y', 8).attr('font-size', 9).attr('fill', '#6b7280').text(`${minVal.toFixed(3)}`)
    lg.append('text').attr('x', 14).attr('y', innerH).attr('font-size', 9).attr('fill', '#6b7280').text(`${maxVal.toFixed(3)}`)

    // Tooltip
    const tooltip = d3.select('body')
      .selectAll('.heatmap-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'fixed')
      .style('background', 'rgba(17,24,39,0.9)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    g.selectAll('rect')
      .on('mousemove', function (event, d) {
        const rel = d.avg_price - overallAvg
        const sign = rel >= 0 ? '+' : ''
        tooltip
          .style('opacity', 1)
          .style('left', event.clientX + 14 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .html(
            `<div style="color:#9ca3af;font-size:10px">${WEEKDAY_LABELS[d.weekday]}, ${d.hour}:00 Uhr</div>` +
            `<div style="font-size:14px;font-weight:700">${d.avg_price.toFixed(3)} EUR/L</div>` +
            `<div style="font-size:10px;color:${rel >= 0 ? '#fca5a5' : '#86efac'}">${sign}${rel.toFixed(3)} vs Ø</div>`
          )
      })
      .on('mouseleave', () => tooltip.style('opacity', 0))

    return () => {
      svg.selectAll('*').remove()
      d3.selectAll('.heatmap-tooltip').remove()
    }
  }, [data, overallAvg])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} />
    </div>
  )
}
