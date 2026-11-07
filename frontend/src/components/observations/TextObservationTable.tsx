import type { DeviceParameter, Observation } from '../../types/api'
import { formatParameterName, formatTimestamp, sortTextObservations } from './observationFormatters'

export interface TextObservationTableProps {
  observations: Observation[]
  parameter: DeviceParameter
}

function getTextBadgeClass(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'failure') return 'text-value-badge text-value-badge--failure'
  if (normalized === 'normal') return 'text-value-badge text-value-badge--normal'
  if (normalized === 'l') return 'text-value-badge text-value-badge--l'
  if (normalized === 'm') return 'text-value-badge text-value-badge--m'
  if (normalized === 'h') return 'text-value-badge text-value-badge--h'
  return ''
}

export function TextObservationTable({ observations, parameter }: TextObservationTableProps) {
  const orderedObservations = sortTextObservations(observations)
  const parameterLabel = formatParameterName(parameter.name)

  if (!orderedObservations.length) {
    return (
      <div className="results-message" role="status">
        <span className="result-icon" aria-hidden="true">
          ⌕
        </span>
        <strong>No valid text observations were returned</strong>
        <span>The returned observations could not be displayed in the table.</span>
      </div>
    )
  }

  return (
    <div className="text-table-section">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3 className="chart-title">{parameterLabel}</h3>
          <span className="chart-subtitle">
            Timestamped observation table · {orderedObservations.length}{' '}
            {orderedObservations.length === 1 ? 'record' : 'records'} in chronological order
          </span>
        </div>
      </div>

      <div className="table-scroll observation-table-wrap">
        <table aria-label={`${parameterLabel} observations`}>
          <thead>
            <tr>
              <th scope="col">Observation Timestamp</th>
              <th scope="col">Recorded {parameterLabel}</th>
            </tr>
          </thead>
          <tbody>
            {orderedObservations.map((item, index) => {
              const rawText = typeof item.text_value === 'string' ? item.text_value.trim() : ''
              const hasValue = rawText.length > 0
              const badgeClass = hasValue ? getTextBadgeClass(rawText) : ''
              return (
                <tr key={`${item.id ?? 'row'}-${index}`}>
                  <td className="observation-timestamp">{formatTimestamp(item.observed_at)}</td>
                  <td className="observation-text">
                    {hasValue ? (
                      badgeClass ? (
                        <span className={badgeClass} title={rawText}>{rawText}</span>
                      ) : (
                        <span title={rawText}>{rawText}</span>
                      )
                    ) : (
                      <span className="observation-empty-value" aria-label="No recorded text value">
                        — (Not recorded)
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

