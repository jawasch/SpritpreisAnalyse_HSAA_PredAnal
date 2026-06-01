import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function MultiStationForecastChart({ stations, height = 280 }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!stations || stations.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = container.clientWidth || 700
    const H = height
    const legendWidth = 130
    const margin = { top: 16, right: legendWidth + 8, bottom: 36, left: 52 }
    const innerW = W - margin.left - margin.right
    const innerH = H - margin.top - margin.bottom

    const allPrices = stations.flatMap((s) => s.forecast.map((d) => d.predicted_price))
    const yExtent = d3.extent(allPrices)
    const yPad = (yExtent[1] - yExtent[0]) * 0.2 || 0.02
    const maxHour = d3.max(stations[0].forecast, (d) => d.hour_offset)

    const xScale = d3.scaleLinear().domain([0, maxHour]).range([0, innerW])
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])
      .nice()

    const lineGen = d3.line()
      .x((d) => xScale(d.hour_offset))
      .y((d) => yScale(d.predicted_price))
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
      .call(d3.axisBottom(xScale).ticks(9).tickFormat((d) => `+${d}h`))
      .call((ax) => ax.select('.domain').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('.tick line').attr('stroke', '#e5e7eb'))
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => d.toFixed(3)))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').remove())
      .call((ax) => ax.selectAll('text').attr('fill', '#6b7280').attr('font-size', 11))

    g.append('text')
      .attr('x', -innerH / 2).attr('y', -40)
      .attr('transform', 'rotate(-90)')
      .attr('fill', '#9ca3af').attr('font-size', 10).attr('text-anchor', 'middle')
      .text('EUR / Liter')

    stations.forEach((s) => {
      g.append('path')
        .datum(s.forecast)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('d', lineGen)
    })

    stations.forEach((s, i) => {
      const lx = margin.left + innerW + 12
      const ly = margin.top + i * 20
      svg.append('line')
        .attr('x1', lx).attr('x2', lx + 16).attr('y1', ly + 6).attr('y2', ly + 6)
        .attr('stroke', s.color).attr('stroke-width', 2)
      svg.append('text')
        .attr('x', lx + 20).attr('y', ly + 10)
        .attr('fill', '#374151').attr('font-size', 11)
        .text(s.name || s.label || '')
    })

    const tooltip = d3.select('body')
      .selectAll('.multi-forecast-tt')
      .data([null])
      .join('div')
      .attr('class', 'multi-forecast-tt')
      .style('position', 'fixed')
      .style('background', 'rgba(17,24,39,0.92)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('line-height', '1.6')
      .style('pointer-events', 'none')
      .style('opacity', 0)

    const vLine = g.append('line')
      .attr('stroke', '#d1d5db').attr('stroke-dasharray', '4')
      .attr('y1', 0).attr('y2', innerH).style('opacity', 0)

    g.append('rect')
      .attr('width', innerW).attr('height', innerH).attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event)
        const hour = Math.round(xScale.invert(mx))
        const clampedHour = Math.max(0, Math.min(maxHour, hour))
        vLine.attr('x1', xScale(clampedHour)).attr('x2', xScale(clampedHour)).style('opacity', 1)

        const rows = stations.map((s) => {
          const pt = s.forecast.find((f) => f.hour_offset === clampedHour) || s.forecast[0]
          const name = s.name || s.label || ''
          return `<span style="color:${s.color}">●</span> ${name}: <b>${pt.predicted_price.toFixed(3)}</b>`
        }).join('<br/>')

        tooltip.style('opacity', 1)
          .style('left', event.clientX + 16 + 'px')
          .style('top', event.clientY - 10 + 'px')
          .html(`<div style="font-size:10px;color:#9ca3af;margin-bottom:3px">+${clampedHour}h</div>${rows}`)
      })
      .on('mouseleave', () => {
        tooltip.style('opacity', 0)
        vLine.style('opacity', 0)
      })

    return () => {
      svg.selectAll('*').remove()
      d3.selectAll('.multi-forecast-tt').remove()
    }
  }, [stations, height])

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg ref={svgRef} />
    </div>
  )
}
