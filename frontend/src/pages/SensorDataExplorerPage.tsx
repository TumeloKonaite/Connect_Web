import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { numericScale } from '../lib/numericScale.js'
import type { DeviceParameter, MonitoringDevice, Observation } from '../types/api'

const PAGE_SIZE = 100

function formatTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Invalid timestamp' : date.toLocaleString()
}

function ObservationChart({ observations, parameter }: { observations: Observation[]; parameter: DeviceParameter }) {
  const points = observations.flatMap((item) => {
    const date = new Date(item.observed_at).getTime()
    const value = item.numeric_value
    return Number.isFinite(date) && typeof value === 'number' && Number.isFinite(value) ? [{ item, date, value }] : []
  }).sort((a, b) => a.date - b.date || a.item.id - b.item.id)
  if (!points.length) return <p className="results-message">No valid numeric observations were returned.</p>
  const width = 760, height = 300, left = 64, right = 20, top = 20, bottom = 58
  const values = points.map((point) => point.value)
  const scale = numericScale(values)
  if (!scale) return <p className="results-message">No valid numeric observations were returned.</p>
  const { min: minValue, max: maxValue, ticks } = scale
  const valueRange = maxValue - minValue || 1
  const firstTime = points[0].date, lastTime = points[points.length - 1].date
  const timeRange = lastTime - firstTime || 1
  const x = (date: number) => left + ((date - firstTime) / timeRange) * (width - left - right)
  const y = (value: number) => top + ((maxValue - value) / valueRange) * (height - top - bottom)
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(point.date)} ${y(point.value)}`).join(' ')
  return <div className="chart-wrap">
    <svg className="observation-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${parameter.name.replaceAll('_', ' ')} over time, ${points.length} observations. Values range from ${Math.min(...values)} to ${Math.max(...values)}${parameter.unit ? ` ${parameter.unit}` : ''}.`}>
      {ticks.map((value) => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-grid"/><text x={left - 10} y={y(value) + 4} textAnchor="end" className="chart-label">{value.toLocaleString(undefined, { maximumSignificantDigits: 5 })}</text></g>)}
      <line x1={left} x2={left} y1={top} y2={height - bottom} className="chart-axis"/><line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} className="chart-axis"/>
      <path d={line} className="chart-line"/>
      {points.map(({ item, date, value }) => <circle key={item.id} cx={x(date)} cy={y(value)} r={points.length === 1 ? 5 : 3.5} className="chart-point"><title>{formatTimestamp(item.observed_at)} · {value}{parameter.unit ? ` ${parameter.unit}` : ''}</title></circle>)}
      {points.length === 1 && <text x={x(firstTime)} y={height - 15} textAnchor="middle" className="chart-label">{formatTimestamp(points[0].item.observed_at)}</text>}
      {points.length > 1 && <><text x={left} y={height - 20} textAnchor="start" className="chart-label">{formatTimestamp(points[0].item.observed_at)}</text><text x={width - right} y={height - 20} textAnchor="end" className="chart-label">{formatTimestamp(points[points.length - 1].item.observed_at)}</text></>}
      <text x={width / 2} y={height - 2} textAnchor="middle" className="chart-axis-title">Timestamp</text>
      <text transform={`translate(16 ${height / 2}) rotate(-90)`} textAnchor="middle" className="chart-axis-title">{parameter.name.replaceAll('_', ' ')}{parameter.unit ? ` (${parameter.unit})` : ''}</text>
    </svg>
  </div>
}

function ObservationResults({ observations, parameter, device, start, end, minimum, maximum, offset, hasMore, onPage, loading }: {
  observations: Observation[] | null; parameter: DeviceParameter | null; device: MonitoringDevice | null; start: string; end: string; minimum?: number; maximum?: number; offset: number; hasMore: boolean; onPage: (offset: number) => void; loading: boolean
}) {
  return <section className="explorer-results" aria-live="polite">
    <div className="results-heading"><div><p className="eyebrow">OBSERVATION RESULTS</p><h2>{observations === null ? 'Ready when you are' : 'Your data'}</h2></div>{observations && <span className="result-count">{observations.length.toLocaleString()} SHOWN</span>}</div>
    {loading ? <div className="results-message"><span className="result-spinner"/><strong>Retrieving observations</strong><span>Loading the requested page.</span></div>
      : observations === null ? <div className="results-message"><span className="result-icon">↗</span><strong>Set your filters to get started</strong><span>Results will appear here after you select a device, parameter and time period.</span></div>
      : observations.length === 0 ? <div className="results-message"><span className="result-icon">⌕</span><strong>No observations found</strong><span>Try a wider time period or adjust the selected value range.</span></div>
      : <><div className="results-context"><strong>{device?.name ?? 'Selected device'}</strong><span>{parameter?.name.replaceAll('_', ' ')} · {parameter?.data_type}{parameter?.unit ? ` · ${parameter.unit}` : ''}</span><span>{formatTimestamp(start)} — {formatTimestamp(end)}</span>{(minimum !== undefined || maximum !== undefined) && <span>Value range: {minimum ?? '−∞'} to {maximum ?? '∞'}{parameter?.unit ? ` ${parameter.unit}` : ''}</span>}</div>
        {parameter?.data_type === 'numeric' ? <ObservationChart observations={observations} parameter={parameter}/> : <div className="table-scroll observation-table-wrap"><table><thead><tr><th scope="col">Timestamp</th><th scope="col">{parameter?.name.replaceAll('_', ' ') ?? 'Recorded value'}</th></tr></thead><tbody>{observations.map((item) => <tr key={item.id}><td>{formatTimestamp(item.observed_at)}</td><td className="observation-text">{item.text_value?.trim() || '—'}</td></tr>)}</tbody></table></div>}
        <nav className="observation-pagination" aria-label="Observation pages"><span>Showing {offset + 1}–{offset + observations.length}{hasMore ? ' (more available)' : ''}</span><div><button type="button" onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0 || loading}>Previous</button><button type="button" onClick={() => onPage(offset + PAGE_SIZE)} disabled={!hasMore || loading}>Next</button></div></nav>
      </>}
    <div className="results-meta"><span className="status-dot"/> CONNECTED TO SENSOR API <span>·</span> CHRONOLOGICAL ORDER</div>
  </section>
}

function toUtcIso(value: string) {
  return new Date(value).toISOString()
}

export function SensorDataExplorerPage() {
  const [devices, setDevices] = useState<MonitoringDevice[]>([])
  const [device, setDevice] = useState<MonitoringDevice | null>(null)
  const [parameters, setParameters] = useState<DeviceParameter[]>([])
  const [parameter, setParameter] = useState<DeviceParameter | null>(null)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [parametersLoading, setParametersLoading] = useState(false)
  const [observations, setObservations] = useState<Observation[] | null>(null)
  const [query, setQuery] = useState<{ device: MonitoringDevice; parameter: DeviceParameter; start: string; end: string; displayStart: string; displayEnd: string; minimum?: number; maximum?: number } | null>(null)
  const [pageOffset, setPageOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [observationsLoading, setObservationsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const [parameterError, setParameterError] = useState('')
  const [start, setStart] = useState('2025-01-01T00:00')
  const [end, setEnd] = useState('2025-01-02T00:00')
  const [minimum, setMinimum] = useState('')
  const [maximum, setMaximum] = useState('')
  const [validation, setValidation] = useState<Record<string, string>>({})
  const requestId = useRef(0)
  const devicesRequest = useRef<AbortController | null>(null)
  const parametersRequest = useRef<AbortController | null>(null)
  const observationsRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    devicesRequest.current = controller
    setDevicesLoading(true)
    api.getDevices(controller.signal)
      .then(setDevices)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setDeviceError(reason instanceof Error ? reason.message : 'Unable to load devices.')
      })
      .finally(() => { if (!controller.signal.aborted) setDevicesLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => () => {
    devicesRequest.current?.abort()
    parametersRequest.current?.abort()
    observationsRequest.current?.abort()
  }, [])

  function changeDevice(uid: string) {
    parametersRequest.current?.abort()
    observationsRequest.current?.abort()
    requestId.current += 1
    const selected = devices.find((item) => item.device_uid === uid) ?? null
    setDevice(selected)
    setParameters([])
    setParameter(null)
    setObservations(null)
    setQuery(null)
    setError('')
    setParameterError('')
    setMinimum('')
    setMaximum('')
    setValidation({})
    if (!selected) return
    const controller = new AbortController()
    parametersRequest.current = controller
    setParametersLoading(true)
    api.getDevice(selected.device_uid, controller.signal)
      .then((detail) => setParameters(detail.parameters))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setParameterError(reason instanceof Error ? reason.message : 'Unable to load parameters.')
      })
      .finally(() => { if (!controller.signal.aborted) setParametersLoading(false) })
  }

  function changeParameter(name: string) {
    const selected = parameters.find((item) => item.name === name) ?? null
    setParameter(selected)
    setObservations(null)
    setQuery(null)
    setError('')
    setValidation({})
    if (selected?.data_type !== 'numeric') {
      setMinimum('')
      setMaximum('')
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const issues: Record<string, string> = {}
    if (!device) issues.device = 'Choose a monitoring device.'
    if (!parameter) issues.parameter = 'Choose a parameter.'
    if (!start || Number.isNaN(new Date(start).getTime())) issues.start = 'Enter a valid start date and time.'
    if (!end || Number.isNaN(new Date(end).getTime())) issues.end = 'Enter a valid end date and time.'
    if (start && end && !Number.isNaN(new Date(start).getTime()) && !Number.isNaN(new Date(end).getTime()) && new Date(start) > new Date(end)) {
      issues.end = 'End must be the same as or later than start.'
    }
    const min = minimum.trim() === '' ? undefined : Number(minimum)
    const max = maximum.trim() === '' ? undefined : Number(maximum)
    if (parameter?.data_type === 'numeric') {
      if (minimum.trim() !== '' && !Number.isFinite(min)) issues.minimum = 'Enter a valid number.'
      if (maximum.trim() !== '' && !Number.isFinite(max)) issues.maximum = 'Enter a valid number.'
      if (min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max) && min > max) {
        issues.maximum = 'Maximum must be greater than or equal to minimum.'
      }
    }
    setValidation(issues)
    if (Object.keys(issues).length || !device || !parameter) return

    observationsRequest.current?.abort()
    const controller = new AbortController()
    observationsRequest.current = controller
    const currentRequest = ++requestId.current
    setObservations(null)
    setError('')
    setObservationsLoading(true)
    const filters = {
        parameter: parameter.name,
        start: toUtcIso(start),
        end: toUtcIso(end),
        ...(parameter.data_type === 'numeric' && min !== undefined ? { minValue: min } : {}),
        ...(parameter.data_type === 'numeric' && max !== undefined ? { maxValue: max } : {}),
      }
    try {
      const result = await api.getObservations(device.device_uid, filters, PAGE_SIZE + 1, 0, controller.signal)
      if (currentRequest === requestId.current) {
        setObservations(result.slice(0, PAGE_SIZE))
        setPageOffset(0)
        setHasMore(result.length > PAGE_SIZE)
        setQuery({ device, parameter, start: filters.start, end: filters.end, displayStart: start, displayEnd: end, minimum: filters.minValue, maximum: filters.maxValue })
      }
    } catch (reason) {
      if (!controller.signal.aborted && currentRequest === requestId.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to retrieve observations. Please try again.')
      }
    } finally {
      if (currentRequest === requestId.current) setObservationsLoading(false)
    }
  }

  async function loadPage(offset: number) {
    if (!query) return
    observationsRequest.current?.abort()
    const controller = new AbortController()
    observationsRequest.current = controller
    const currentRequest = ++requestId.current
    setObservations(null)
    setObservationsLoading(true)
    setError('')
    try {
      const result = await api.getObservations(query.device.device_uid, { parameter: query.parameter.name, start: query.start, end: query.end, ...(query.minimum !== undefined ? { minValue: query.minimum } : {}), ...(query.maximum !== undefined ? { maxValue: query.maximum } : {}) }, PAGE_SIZE + 1, offset, controller.signal)
      if (currentRequest === requestId.current) { setObservations(result.slice(0, PAGE_SIZE)); setPageOffset(offset); setHasMore(result.length > PAGE_SIZE) }
    } catch (reason) {
      if (!controller.signal.aborted && currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : 'Unable to retrieve observations. Please try again.')
    } finally { if (currentRequest === requestId.current) setObservationsLoading(false) }
  }

  return (
    <>
      <section className="welcome-row sensor-page-heading">
        <div>
          <p className="eyebrow">DATA EXPLORER <span className="eyebrow-line" /></p>
          <h1>Sensor data explorer</h1>
          <p className="intro">Choose a device, measurement and time period to retrieve matching observations.</p>
        </div>
        <div className="today-chip"><span className="live-dot" /> DEMONSTRATION DATA · UTC</div>
      </section>

      <div className="explorer-layout">
        <form className="explorer-form" onSubmit={submit} noValidate>
          <div className="form-heading">
            <div><p className="eyebrow">QUERY SETUP</p><h3>Choose what to explore</h3></div>
            <span className="step-count">01 — 04</span>
          </div>

          <div className="explorer-fields">
            <label className="explorer-field explorer-field--wide" htmlFor="monitoring-device">
              Monitoring device
              <select id="monitoring-device" value={device?.device_uid ?? ''} onChange={(event) => changeDevice(event.target.value)} disabled={devicesLoading} aria-invalid={!!validation.device}>
                <option value="">{devicesLoading ? 'Loading devices…' : 'Select a device'}</option>
                {devices.map((item) => <option key={item.device_uid} value={item.device_uid}>{item.name} · {item.device_uid}</option>)}
              </select>
              {deviceError && <span className="field-error" role="alert">{deviceError}</span>}
              {!devicesLoading && !deviceError && devices.length === 0 && <span className="field-hint">No monitoring devices are available yet.</span>}
              {validation.device && <span className="field-error" role="alert">{validation.device}</span>}
            </label>

            <label className="explorer-field explorer-field--wide" htmlFor="parameter-select">
              Parameter
              <select id="parameter-select" value={parameter?.name ?? ''} onChange={(event) => changeParameter(event.target.value)} disabled={!device || parametersLoading || !!parameterError} aria-invalid={!!validation.parameter}>
                <option value="">{!device ? 'Select a device first' : parametersLoading ? 'Loading parameters…' : parameterError ? 'Parameters unavailable' : 'Select a parameter'}</option>
                {parameters.map((item) => <option key={item.id} value={item.name}>{item.name.replaceAll('_', ' ')}{item.unit ? ` · ${item.unit}` : ''} ({item.data_type})</option>)}
              </select>
              {parameterError && <span className="field-error" role="alert">{parameterError}</span>}
              {device && !parametersLoading && !parameterError && parameters.length === 0 && <span className="field-hint">This device has no configured parameters.</span>}
              {validation.parameter && <span className="field-error" role="alert">{validation.parameter}</span>}
            </label>

            <div className="explorer-field"><label htmlFor="range-start">Start date &amp; time</label><input id="range-start" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} aria-invalid={!!validation.start} />{validation.start && <span className="field-error" role="alert">{validation.start}</span>}</div>
            <div className="explorer-field"><label htmlFor="range-end">End date &amp; time</label><input id="range-end" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} aria-invalid={!!validation.end} />{validation.end && <span className="field-error" role="alert">{validation.end}</span>}</div>

            {parameter?.data_type === 'numeric' && <>
              <div className="explorer-field"><label htmlFor="minimum-value">Minimum value{parameter.unit && <span className="unit-label">{parameter.unit}</span>}</label><input id="minimum-value" type="number" step="any" value={minimum} placeholder="No minimum" onChange={(event) => setMinimum(event.target.value)} aria-invalid={!!validation.minimum} />{validation.minimum && <span className="field-error" role="alert">{validation.minimum}</span>}</div>
              <div className="explorer-field"><label htmlFor="maximum-value">Maximum value{parameter.unit && <span className="unit-label">{parameter.unit}</span>}</label><input id="maximum-value" type="number" step="any" value={maximum} placeholder="No maximum" onChange={(event) => setMaximum(event.target.value)} aria-invalid={!!validation.maximum} />{validation.maximum && <span className="field-error" role="alert">{validation.maximum}</span>}</div>
            </>}
          </div>

          <div className="timezone-note"><span aria-hidden="true">◷</span><span>Times use your local timezone and are sent to the API in UTC.</span></div>
          <button className="primary-button explorer-submit" type="submit" disabled={observationsLoading || devicesLoading || !!deviceError || !!parameterError}>
            {observationsLoading ? <><span className="button-spinner" /> Retrieving observations…</> : <>View data <span aria-hidden="true">→</span></>}
          </button>
        </form>

        {error ? <section className="explorer-results" aria-live="polite"><div className="results-heading"><div><p className="eyebrow">OBSERVATION RESULTS</p><h2>Unable to load data</h2></div></div><div className="results-message results-message--error" role="alert"><span className="result-icon">!</span><strong>Couldn’t retrieve observations</strong><span>{error}</span></div></section> : <ObservationResults observations={observations} parameter={query?.parameter ?? null} device={query?.device ?? null} start={query?.displayStart ?? start} end={query?.displayEnd ?? end} minimum={query?.minimum} maximum={query?.maximum} offset={pageOffset} hasMore={hasMore} onPage={loadPage} loading={observationsLoading} />}
      </div>
    </>
  )
}
