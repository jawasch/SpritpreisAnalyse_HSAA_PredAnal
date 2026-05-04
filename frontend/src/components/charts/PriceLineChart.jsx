import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { FUEL_COLORS, FUEL_LABELS } from '../../services/api'

export default function PriceLineChart({ datasets, width = '100%' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!datasets || datasets.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 700
    const H = 280
    const margin = { top: 16, right: 24, bottom: 36, left: 52 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom

    const allPoints = datasets.flatMap((d) => d.data)
    const parseTime = (s) => new Date(s)

    const xExtent = d3.extent(allPoints, (d) => parseTime(d.timestamp))
    const yExtent = d3.extent(allPoints, (d) => d.price)
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 0.05

    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW])
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])
      .nice()

    const lineGen = d3.line()
      .x((d) => xScale(parseTime(d.timestamp)))
      .y((d) => yScale(d.price))
      .curve(d3.curveMonotoneX)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yScale)
          .tickSize(-innerW)
          .tickFormat('')
          .ticks(5)
      )
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', '#f0f0f0'))

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%d.%m')))
      .call((g) => g.select('.domain').attr('stroke', '#e5e7eb'))
      .call((g) => g.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call((g) => g.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => d.toFixed(3)))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').remove())
      .call((g) => g.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('text')
      .attr('x', -innerH / 2)
      .attr('y', -40)
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#9ca3af')
      .attr('font-size', 10)
      .attr('text-anchor', 'middle')
      .text('EUR / Liter')

    // Lines
    datasets.forEach(({ fuelType, data }) => {
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', FUEL_COLORS[fuelType])
        .attr('stroke-width', 2)
        .attr('d', lineGen)
    })

    // Tooltip overlay
    const tooltip = d3.select('body')
      .selectAll('.price-chart-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'price-chart-tooltip')
      .style('position', 'fixed')
      .style('background', 'rgba(17,24,39,0.9)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    const bisect = d3.bisector((d) => parseTime(d.timestamp)).left

    const overlay = g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')

    const vLine = g.append('line')
      .attr('stroke', '#d1d5db')
      .attr('stroke-dasharray', '4')
      .attr('y1', 0)
      .attr('y2', innerH)
      .style('opacity', 0)

    overlay
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event)
        const date = xScale.invert(mx)
        vLine.attr('x1', mx).attr('x2', mx).style('opacity', 1)
        const lines = datasets.map(({ fuelType, data }) => {
          const i = bisect(data, date, 1)
          const d0 = data[i - 1]
          const d1 = data[i]
          const d = !d1 || (d0 && date - parseTime(d0.timestamp) < parseTime(d1.timestamp) - date) ? d0 : d1
          return d ? `${FUEL_LABELS[fuelType]}: <b>${d.price.toFixed(3)}</b>` : null
        }).filter(Boolean).join('<br/>')

        const dateStr = d3.timeFormat('%d.%m.%Y')(date)
        tooltip
          .style('opacity', 1)
          .style('left', event.clientX + 16 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .html(`<div style="font-size:10px;color:#9ca3af;margin-bottom:2px">${dateStr}</div>${lines}`)
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
        vLine.style('opacity', 0)
      })

    return () => {
      svg.selectAll('*').remove()
      d3.selectAll('.price-chart-tooltip').remove()
    }
  }, [datasets])

  return (
    <div ref={containerRef} style={{ width }}>
      <svg ref={svgRef} />
    </div>
  )
}
