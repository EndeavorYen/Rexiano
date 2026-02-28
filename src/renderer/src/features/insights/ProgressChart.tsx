/**
 * ProgressChart — Pure SVG line chart for practice accuracy trends.
 *
 * Renders an accuracy-over-sessions chart with:
 * - Gradient-filled area under the line
 * - Data point dots
 * - X axis: session number, Y axis: accuracy %
 * - Responsive: fills parent container width
 * - Themed via CSS custom properties
 *
 * No external chart library — just SVG + math.
 */

import { useId } from 'react'

interface ProgressChartProps {
  /** Accuracy values (0-100) in chronological order */
  data: number[]
  /** Chart width in pixels */
  width?: number
  /** Chart height in pixels */
  height?: number
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 40 }
const DOT_RADIUS = 4
const Y_MIN = 0
const Y_MAX = 100
const Y_TICKS = [0, 25, 50, 75, 100]

/**
 * Simple linear regression: y = slope * x + intercept
 * @param values - Array of y-values with implicit x = index
 */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

export function ProgressChart({ data, width = 400, height = 200 }: ProgressChartProps): React.JSX.Element {
  // useId must be called unconditionally (React hooks rule)
  const reactId = useId()
  const gradientId = `progress-gradient-${reactId.replace(/:/g, '')}`

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs font-body"
        style={{ width, height, color: 'var(--color-text-muted)' }}
      >
        No data yet
      </div>
    )
  }

  const plotW = width - PADDING.left - PADDING.right
  const plotH = height - PADDING.top - PADDING.bottom

  // Map data points to SVG coordinates
  const points = data.map((val, i) => {
    const x = PADDING.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
    const y = PADDING.top + plotH - ((val - Y_MIN) / (Y_MAX - Y_MIN)) * plotH
    return { x, y, val }
  })

  // Build polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Build area fill path (close at bottom)
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${PADDING.top + plotH}` +
    ` L ${points[0].x} ${PADDING.top + plotH} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label="Accuracy trend chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines and labels */}
      {Y_TICKS.map((tick) => {
        const y = PADDING.top + plotH - ((tick - Y_MIN) / (Y_MAX - Y_MIN)) * plotH
        return (
          <g key={tick}>
            <line
              x1={PADDING.left}
              y1={y}
              x2={width - PADDING.right}
              y2={y}
              stroke="var(--color-grid-line, var(--color-border))"
              strokeWidth={1}
              strokeDasharray={tick === 0 || tick === 100 ? 'none' : '3,3'}
              opacity={0.5}
            />
            <text
              x={PADDING.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fontFamily="JetBrains Mono Variable, JetBrains Mono, monospace"
              fill="var(--color-text-muted)"
            >
              {tick}%
            </text>
          </g>
        )
      })}

      {/* X-axis labels */}
      {points.map((p, i) => {
        // Show label every N points to avoid crowding
        const step = Math.max(1, Math.ceil(data.length / 8))
        if (i % step !== 0 && i !== data.length - 1) return null
        return (
          <text
            key={i}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            fontSize={9}
            fontFamily="JetBrains Mono Variable, JetBrains Mono, monospace"
            fill="var(--color-text-muted)"
          >
            #{i + 1}
          </text>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={DOT_RADIUS}
            fill="var(--color-surface)"
            stroke="var(--color-accent)"
            strokeWidth={2}
          />
          {/* Tooltip-like hover target */}
          <title>{`Session ${i + 1}: ${p.val.toFixed(1)}%`}</title>
        </g>
      ))}

      {/* Trend line (linear regression) */}
      {data.length >= 3 && (() => {
        const { slope, intercept } = linearRegression(data)
        const yStart = intercept
        const yEnd = intercept + slope * (data.length - 1)
        const startY = PADDING.top + plotH - ((yStart - Y_MIN) / (Y_MAX - Y_MIN)) * plotH
        const endY = PADDING.top + plotH - ((yEnd - Y_MIN) / (Y_MAX - Y_MIN)) * plotH
        return (
          <line
            x1={points[0].x}
            y1={startY}
            x2={points[points.length - 1].x}
            y2={endY}
            stroke="var(--color-accent)"
            strokeWidth={1}
            strokeDasharray="6,4"
            opacity={0.4}
          />
        )
      })()}
    </svg>
  )
}
