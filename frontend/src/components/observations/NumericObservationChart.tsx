import { useState } from 'react'
import { numericScale } from '../../lib/numericScale.js'
import type { DeviceParameter, Observation } from '../../types/api'
import {
  computeTimeTicks,
  extractValidNumericPoints,
  formatAxisTimestamp,
  formatNumericValue,
  formatParameterName,
  formatTickValue,
  formatTimestamp,
} from './observationFormatters'

export interface NumericObservationChartProps {
  observations: Observation[]
  parameter: DeviceParameter
}

export function NumericObservationChart({
  observations,
  parameter,
}: NumericObservationChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const points = extractValidNumericPoints(observations)

  if (!points.length) {
    return (
      <div className="results-message" role="status">
        <span className="result-icon" aria-hidden="true">
          ⌕
        </span>
        <strong>No valid numeric observations were returned</strong>
        <span>The returned observations could not be plotted as numeric measurements.</span>
      </div>
    )
  }

  const values = points.map((point) => point.value)
  const scale = numericScale(values)
  if (!scale) {
    return (
      <div className="results-message" role="status">
        <span className="result-icon" aria-hidden="true">
          ⌕
        </span>
        <strong>No valid numeric observations were returned</strong>
        <span>The returned observations could not be plotted as numeric measurements.</span>
      </div>
    )
  }

  const width = 760
  const height = 310
  const left = 68
  const right = 24
  const top = 24
  const bottom = 62
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  const { min: minValue, max: maxValue, ticks } = scale
  const valueRange = maxValue - minValue || 1
  const firstTime = points[0].date
  const lastTime = points[points.length - 1].date
  const timeRange = lastTime - firstTime

  const x = (date: number) =>
    timeRange === 0 ? left + plotWidth / 2 : left + ((date - firstTime) / timeRange) * plotWidth
  const y = (value: number) => top + ((maxValue - value) / valueRange) * plotHeight

  const line = points
    .map((point, index) => `${index ? 'L' : 'M'} ${x(point.date).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(' ')

  const area =
    points.length > 1
      ? `${line} L ${x(lastTime).toFixed(2)} ${(height - bottom).toFixed(2)} L ${x(firstTime).toFixed(2)} ${(height - bottom).toFixed(2)} Z`
      : ''

  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const dataAvg = values.reduce((sum, val) => sum + val, 0) / values.length
  const unitSuffix = parameter.unit ? ` ${parameter.unit}` : ''
  const parameterLabel = formatParameterName(parameter.name)
  const timeTicks = computeTimeTicks(firstTime, lastTime, points.length >= 3 ? 3 : 2)

  const validActiveIndex =
    activeIndex !== null && activeIndex >= 0 && activeIndex < points.length ? activeIndex : null
  const activePoint = validActiveIndex !== null ? points[validActiveIndex] : null

  const summaryText = `${parameterLabel} over time, ${points.length} ${
    points.length === 1 ? 'observation' : 'observations'
  } from ${formatTimestamp(points[0].item.observed_at)} to ${formatTimestamp(
    points[points.length - 1].item.observed_at,
  )}. Values range from ${formatNumericValue(dataMin)}${unitSuffix} to ${formatNumericValue(
    dataMax,
  )}${unitSuffix}.`

  return (
    <div className="chart-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3 className="chart-title">
            {parameterLabel}
            {parameter.unit ? <span className="chart-unit-badge">{parameter.unit}</span> : null}
          </h3>
          <span className="chart-subtitle">
            Time-series line chart · {points.length}{' '}
            {points.length === 1 ? 'observation' : 'observations'} plotted chronologically
          </span>
        </div>

        <dl className="chart-stats" aria-label="Plotted observation statistics">
          <div className="chart-stat">
            <dt>Min</dt>
            <dd>
              {formatNumericValue(dataMin)}
              {unitSuffix}
            </dd>
          </div>
          <div className="chart-stat">
            <dt>Max</dt>
            <dd>
              {formatNumericValue(dataMax)}
              {unitSuffix}
            </dd>
          </div>
          <div className="chart-stat">
            <dt>Avg</dt>
            <dd>
              {Number(dataAvg.toPrecision(6))}
              {unitSuffix}
            </dd>
          </div>
        </dl>
      </div>

      <div className="chart-inspector" aria-live="polite">
        {activePoint ? (
          <div className="chart-tooltip-banner chart-tooltip-banner--active" data-testid="chart-tooltip">
            <span className="tooltip-dot" aria-hidden="true" />
            <span className="tooltip-time">{formatTimestamp(activePoint.item.observed_at)}</span>
            <span className="tooltip-sep" aria-hidden="true">
              ·
            </span>
            <strong className="tooltip-value">
              {parameterLabel}: {formatNumericValue(activePoint.value)}
              {unitSuffix}
            </strong>
            {activePoint.item.source_udi !== null && (
              <span className="tooltip-udi">UDI #{activePoint.item.source_udi}</span>
            )}
          </div>
        ) : (
          <div className="chart-tooltip-banner">
            <span className="tooltip-hint">
              Hover or focus a data point to inspect its exact timestamp and recorded value.
            </span>
          </div>
        )}
      </div>

      <div className="chart-wrap">
        <svg
          className="observation-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summaryText}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <desc>{summaryText}</desc>
          <defs>
            <linearGradient id="observation-area-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1b7657" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#1b7657" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                className={value === 0 ? 'chart-grid chart-grid--zero' : 'chart-grid'}
              />
              <text x={left - 10} y={y(value) + 4} textAnchor="end" className="chart-label">
                {formatTickValue(value)}
              </text>
            </g>
          ))}

          {timeTicks.map((tickMs, idx) => {
            const tickX = x(tickMs)
            const anchor =
              timeTicks.length === 1
                ? 'middle'
                : idx === 0
                  ? 'start'
                  : idx === timeTicks.length - 1
                    ? 'end'
                    : 'middle'
            return (
              <g key={`${tickMs}-${idx}`}>
                <line
                  x1={tickX}
                  x2={tickX}
                  y1={top}
                  y2={height - bottom}
                  className="chart-grid-vertical"
                />
                <line
                  x1={tickX}
                  x2={tickX}
                  y1={height - bottom}
                  y2={height - bottom + 5}
                  className="chart-axis"
                />
                <text x={tickX} y={height - 24} textAnchor={anchor} className="chart-label">
                  {formatAxisTimestamp(tickMs, timeRange)}
                </text>
              </g>
            )
          })}

          <line x1={left} x2={left} y1={top} y2={height - bottom} className="chart-axis" />
          <line
            x1={left}
            x2={width - right}
            y1={height - bottom}
            y2={height - bottom}
            className="chart-axis"
          />

          {area && <path d={area} className="chart-area" fill="url(#observation-area-gradient)" />}
          {points.length > 1 && <path d={line} className="chart-line" />}

          {activePoint && (
            <line
              x1={x(activePoint.date)}
              x2={x(activePoint.date)}
              y1={top}
              y2={height - bottom}
              className="chart-crosshair"
            />
          )}

          {points.map(({ item, date, value }, index) => {
            const cx = x(date)
            const cy = y(value)
            const isSelected = validActiveIndex === index
            const pointRadius = points.length === 1 ? 6 : isSelected ? 5.5 : 3.75
            const pointLabel = `${formatTimestamp(item.observed_at)} · ${formatNumericValue(
              value,
            )}${unitSuffix}`
            return (
              <g key={`${item.id}-${index}`} className="chart-point-group">
                <circle
                  cx={cx}
                  cy={cy}
                  r={pointRadius}
                  tabIndex={0}
                  role="button"
                  aria-label={`${parameterLabel} at ${pointLabel}`}
                  className={isSelected ? 'chart-point chart-point--active' : 'chart-point'}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex((current) => (current === index ? null : current))}
                >
                  <title>{pointLabel}</title>
                </circle>
              </g>
            )
          })}

          <text x={left + plotWidth / 2} y={height - 4} textAnchor="middle" className="chart-axis-title">
            Timestamp
          </text>
          <text
            transform={`translate(16 ${top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            className="chart-axis-title"
          >
            {parameterLabel}
            {parameter.unit ? ` (${parameter.unit})` : ''}
          </text>
        </svg>
      </div>
    </div>
  )
}

