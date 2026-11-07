import type { DeviceParameter, MonitoringDevice, Observation } from '../../types/api'
import { NumericObservationChart } from './NumericObservationChart'
import { TextObservationTable } from './TextObservationTable'
import { formatNumericValue, formatParameterName, formatTimestamp } from './observationFormatters'

export interface ObservationResultsProps {
  observations: Observation[] | null
  parameter: DeviceParameter | null
  device: MonitoringDevice | null
  start: string
  end: string
  minimum?: number
  maximum?: number
  offset: number
  pageSize: number
  hasMore: boolean
  onPage: (offset: number) => void
  loading: boolean
  error?: string
}

export function ObservationResults({
  observations,
  parameter,
  device,
  start,
  end,
  minimum,
  maximum,
  offset,
  pageSize,
  hasMore,
  onPage,
  loading,
  error,
}: ObservationResultsProps) {
  const parameterLabel = parameter ? formatParameterName(parameter.name) : 'Selected parameter'
  const currentPage = Math.floor(offset / pageSize) + 1
  const hasFiltersApplied = minimum !== undefined || maximum !== undefined

  return (
    <section className="explorer-results" aria-live="polite" aria-busy={loading}>
      <div className="results-heading">
        <div>
          <p className="eyebrow">OBSERVATION RESULTS</p>
          <h2>
            {error
              ? 'Unable to load data'
              : loading
                ? 'Loading observations…'
                : observations === null
                  ? 'Ready when you are'
                  : parameter
                    ? `${parameterLabel}${parameter.unit ? ` (${parameter.unit})` : ''}`
                    : 'Your data'}
          </h2>
        </div>
        {observations && !loading && !error && (
          <span className="result-count">
            {observations.length.toLocaleString()} {observations.length === 1 ? 'ROW' : 'ROWS'} SHOWN
          </span>
        )}
      </div>

      {device && parameter && (observations !== null || loading || error) && (
        <div className="results-context" aria-label="Applied query context">
          <div className="context-chip">
            <span className="context-label">Device</span>
            <strong>{device.name}</strong>
            <code className="context-uid">{device.device_uid}</code>
          </div>
          <div className="context-chip">
            <span className="context-label">Parameter</span>
            <strong>{parameterLabel}</strong>
            <span className={`data-type-pill data-type-pill--${parameter.data_type}`}>
              {parameter.data_type}
            </span>
            {parameter.unit && <span className="context-unit">Unit: {parameter.unit}</span>}
          </div>
          <div className="context-chip">
            <span className="context-label">Time Period</span>
            <span>
              {formatTimestamp(start)} — {formatTimestamp(end)}
            </span>
          </div>
          {parameter.data_type === 'numeric' && hasFiltersApplied && (
            <div className="context-chip context-chip--highlight">
              <span className="context-label">Value Filter</span>
              <span>
                {minimum !== undefined ? formatNumericValue(minimum) : '−∞'} to{' '}
                {maximum !== undefined ? formatNumericValue(maximum) : '∞'}
                {parameter.unit ? ` ${parameter.unit}` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="results-message" role="status">
          <span className="result-spinner" aria-hidden="true" />
          <strong>Retrieving observations</strong>
          <span>Loading the requested observation page from the sensor API.</span>
        </div>
      ) : error ? (
        <div className="results-message results-message--error" role="alert">
          <span className="result-icon" aria-hidden="true">
            !
          </span>
          <strong>Couldn’t retrieve observations</strong>
          <span>{error}</span>
          <button type="button" className="inline-retry" onClick={() => onPage(offset)} disabled={!parameter || !device}>Try again</button>
        </div>
      ) : observations === null ? (
        <div className="results-message">
          <span className="result-icon" aria-hidden="true">
            ↗
          </span>
          <strong>Set your filters to get started</strong>
          <span>
            Results will appear here after you select a monitoring device, parameter, and time
            period.
          </span>
        </div>
      ) : observations.length === 0 ? (
        <div className="results-message" role="status">
          <span className="result-icon" aria-hidden="true">
            ⌕
          </span>
          <strong>No observations found</strong>
          <span>
            No {parameterLabel.toLowerCase()} observations matched the selected time period
            {hasFiltersApplied ? ' and value range' : ''}. Try adjusting your filters.
          </span>
        </div>
      ) : (
        <>
          {parameter?.data_type === 'numeric' ? (
            <NumericObservationChart observations={observations} parameter={parameter} />
          ) : parameter ? (
            <TextObservationTable observations={observations} parameter={parameter} />
          ) : null}

          <nav className="observation-pagination" aria-label="Observation pages">
            <div className="pagination-summary">
              <strong>
                Page {currentPage} · Showing {offset + 1}–{offset + observations.length}
              </strong>
              <span>
                {hasMore
                  ? `More observations available (displaying ${pageSize} per page)`
                  : offset > 0
                    ? 'End of matching observations'
                    : `All ${observations.length} matching observations shown`}
              </span>
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                onClick={() => onPage(Math.max(0, offset - pageSize))}
                disabled={offset === 0 || loading}
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => onPage(offset + pageSize)}
                disabled={!hasMore || loading}
              >
                Next →
              </button>
            </div>
          </nav>
        </>
      )}

      <div className="results-meta">
        <span className="status-dot" aria-hidden="true" /> CONNECTED TO SENSOR API <span>·</span>{' '}
        CHRONOLOGICAL ORDER
      </div>
    </section>
  )
}

