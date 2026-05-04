import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { FUEL_COLORS } from '../../services/api'

export default function PredictionChart({ predictions, fuelType, currentPrice }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!predictions || predictions.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 700
    const H = 300
    const margin = { top: 16, right: 24, bottom: 40, left: 56 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom

    const parse = (s) => new Date(s)
    const color = FUEL_COLORS[fuelType]
    const now = new Date()

    const xScale = d3.scaleTime()
      .domain(d3.extent(predictions, (d) => parse(d.timestamp)))
      .range([0, innerW])

    const allVals = predictions.flatMap((d) => [d.confidence_lower, d.confidence_upper])
    const yPad = (d3.max(allVals) - d3.min(allVals)) * 0.2
    const yScale = d3.scaleLinear()
      .domain([d3.min(allVals) - yPad, d3.max(allVals) + yPad])
      .range([innerH, 0])
      .nice()

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Grid
    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(5))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#f3f4f6'))

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat('%d.%m %H:%M')))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 10).attr('transform', 'rotate(-30)').attr('text-anchor', 'end'))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => d.toFixed(3)))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('text')
      .attr('x', -innerH / 2).attr('y', -44)
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#9ca3af').attr('font-size', 10).attr('text-anchor', 'middle')
      .text('EUR / Liter')

    // Confidence band
    const area = d3.area()
      .x((d) => xScale(parse(d.timestamp)))
      .y0((d) => yScale(d.confidence_lower))
      .y1((d) => yScale(d.confidence_upper))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(predictions)
      .attr('fill', color)
      .attr('opacity', 0.12)
      .attr('d', area)

    // Predicted line
    const line = d3.line()
      .x((d) => xScale(parse(d.timestamp)))
      .y((d) => yScale(d.predicted_price))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(predictions)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('d', line)

    // "Now" vertical line
    const nowX = xScale(now)
    if (nowX >= 0 && nowX <= innerW) {
      g.append('line')
        .attr('x1', nowX).attr('x2', nowX)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#9ca3af')
        .attr('stroke-dasharray', '4')
        .attr('stroke-width', 1)

      g.append('text')
        .attr('x', nowX + 4).attr('y', 10)
        .attr('fill', '#9ca3af').attr('font-size', 9)
        .text('Jetzt')
    }

    // Current price dot
    if (currentPrice) {
      g.append('circle')
        .attr('cx', nowX)
        .attr('cy', yScale(currentPrice))
        .attr('r', 5)
        .attr('fill', color)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
    }

    // Tooltip
    const tooltip = d3.select('body')
      .selectAll('.pred-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'pred-tooltip')
      .style('position', 'fixed')
      .style('background', 'rgba(17,24,39,0.9)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    const bisect = d3.bisector((d) => parse(d.timestamp)).left
    const vLine = g.append('line')
      .attr('stroke', '#d1d5db')
      .attr('stroke-dasharray', '3')
      .attr('y1', 0).attr('y2', innerH)
      .style('opacity', 0)

    g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event)
        const date = xScale.invert(mx)
        const i = bisect(predictions, date, 1)
        const d0 = predictions[i - 1]
        const d1 = predictions[i]
        const d = !d1 || (d0 && date - parse(d0.timestamp) < parse(d1.timestamp) - date) ? d0 : d1
        if (!d) return
        vLine.attr('x1', mx).attr('x2', mx).style('opacity', 1)
        const dateStr = d3.timeFormat('%d.%m. %H:%M')(parse(d.timestamp))
        tooltip
          .style('opacity', 1)
          .style('left', event.clientX + 16 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .html(
            `<div style="font-size:10px;color:#9ca3af">${dateStr}</div>` +
            `<div>Prognose: <b>${d.predicted_price.toFixed(3)} EUR/L</b></div>` +
            `<div style="font-size:10px;color:#9ca3af">` +
            `${d.confidence_lower.toFixed(3)} – ${d.confidence_upper.toFixed(3)}</div>`
          )
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
        vLine.style('opacity', 0)
      })

    return () => {
      svg.selectAll('*').remove()
      d3.selectAll('.pred-tooltip').remove()
    }
  }, [predictions, fuelType, currentPrice])

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} />
    </div>
  )
}
