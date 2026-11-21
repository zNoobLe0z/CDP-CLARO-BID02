import { useEffect, useId, useRef, useState } from 'react'
import type { DashboardTimeline } from '../types'
import { dateLabel, number } from '../../../lib/format'

export function PhysicalProgressChart({ data }: { data: DashboardTimeline }) {
  const [index, setIndex] = useState(Number.POSITIVE_INFINITY)
  const id = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(680)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () =>
      setWidth(Math.max(280, svg.getBoundingClientRect().width || 680))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  const points = data.points
  if (!points.length) return null
  const selected = Math.min(index, points.length - 1)
  const point = points[selected]
  const left = 44,
    right = width - 16,
    top = 14,
    bottom = 202
  const min = Date.parse(points[0].date),
    max = Date.parse(points.at(-1)!.date)
  const x = (date: string) =>
    left + ((Date.parse(date) - min) / Math.max(1, max - min)) * (right - left)
  const y = (value: string | null) =>
    bottom - (Number(value ?? 0) / 100) * (bottom - top)
  const path = points
    .map(
      (point, index) =>
        `${index ? 'L' : 'M'}${x(point.date)},${y(point.executed_percentage)}`,
    )
    .join(' ')
  const ticks = [
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1,
  ].filter((value, index, array) => array.indexOf(value) === index)
  function selectAt(clientX: number, svg: SVGSVGElement) {
    const box = svg.getBoundingClientRect()
    const coordinate = ((clientX - box.left) / box.width) * width
    const nearest = points.reduce(
      (best, point, index) =>
        Math.abs(x(point.date) - coordinate) <
        Math.abs(x(points[best].date) - coordinate)
          ? index
          : best,
      0,
    )
    setIndex(nearest)
  }
  return (
    <div className="physical-chart">
      <div className="chart-legend">
        <span>
          <i className="legend-real" />
          Realizado
        </span>
        <span className="text-secondary">
          <i className="legend-plan" />
          Planejado: sem base cadastrada
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} 232`}
        className="timeline-svg"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
        onPointerMove={(event) => selectAt(event.clientX, event.currentTarget)}
        onPointerDown={(event) => selectAt(event.clientX, event.currentTarget)}
      >
        <title id={`${id}-title`}>Evolução do avanço físico acumulado</title>
        <desc id={`${id}-description`}>
          Percentual ponderado pelo escopo, após correções. Explore os valores
          pelo controle abaixo ou consulte a tabela. Sem linha planejada porque
          o cronograma não foi integrado.
        </desc>
        {[0, 50, 100].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={right}
              y1={y(String(value))}
              y2={y(String(value))}
              className="chart-grid-line"
            />
            <text
              x={left - 10}
              y={y(String(value)) + 4}
              textAnchor="end"
              className="chart-axis-text"
            >
              {value}%
            </text>
          </g>
        ))}
        <path
          d={`${path} L${right},${bottom} L${left},${bottom} Z`}
          fill="var(--brand-action)"
          opacity="0.08"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--brand-action)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(point.date)}
          x2={x(point.date)}
          y1={top}
          y2={bottom}
          className="chart-crosshair"
        />
        <circle
          cx={x(point.date)}
          cy={y(point.executed_percentage)}
          r={4}
          fill="var(--bg-surface)"
          stroke="var(--brand-ink)"
          strokeWidth={2}
        />
        {ticks.map((index, position) => (
          <text
            key={index}
            x={x(points[index].date)}
            y={226}
            textAnchor={
              position === 0
                ? 'start'
                : position === ticks.length - 1
                  ? 'end'
                  : 'middle'
            }
            className="chart-axis-text"
          >
            {dateLabel(points[index].date).slice(0, 5)}
          </text>
        ))}
      </svg>
      <div className="chart-readout" aria-live="polite">
        <time dateTime={point.date}>{dateLabel(point.date)}</time>
        <span>
          Realizado <strong>{number(point.executed_percentage ?? '0')}%</strong>
        </span>
        <span>
          Planejado <strong>Não disponível</strong>
        </span>
        <span>
          Variação no período{' '}
          <strong>
            {number(
              Number(point.executed_percentage) -
                Number(data.baseline_percentage),
            )}{' '}
            pp
          </strong>
        </span>
      </div>
      <label className="chart-range-label" htmlFor={`${id}-range`}>
        Explorar evolução
        <input
          id={`${id}-range`}
          type="range"
          min={0}
          max={Math.max(0, points.length - 1)}
          step={1}
          value={selected}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-valuetext={`${dateLabel(point.date)}, ${number(point.executed_percentage ?? '0')} por cento executado`}
        />
      </label>
      <details className="chart-data">
        <summary>Consultar valores da curva</summary>
        <div
          className="table-scroll max-h-48"
          role="region"
          aria-label="Valores da evolução física"
          tabIndex={0}
        >
          <table className="data-grid">
            <caption className="sr-only">
              Valores de fechamento; amostragem de até 62 pontos
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className="numeric">
                  Realizado
                </th>
                <th scope="col">Planejado</th>
              </tr>
            </thead>
            <tbody>
              {points.map((row) => (
                <tr key={row.date}>
                  <td className="font-mono text-xs">{dateLabel(row.date)}</td>
                  <td className="numeric">
                    {number(row.executed_percentage ?? '0')}%
                  </td>
                  <td>Não disponível</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
