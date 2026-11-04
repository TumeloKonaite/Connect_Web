import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import type { DeviceParameter, MonitoringDevice, Observation } from '../types/api'

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
    try {
      const result = await api.getObservations(device.device_uid, {
        parameter: parameter.name,
        start: toUtcIso(start),
        end: toUtcIso(end),
        ...(parameter.data_type === 'numeric' && min !== undefined ? { minValue: min } : {}),
        ...(parameter.data_type === 'numeric' && max !== undefined ? { maxValue: max } : {}),
      }, controller.signal)
      if (currentRequest === requestId.current) setObservations(result)
    } catch (reason) {
      if (!controller.signal.aborted && currentRequest === requestId.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to retrieve observations. Please try again.')
      }
    } finally {
      if (currentRequest === requestId.current) setObservationsLoading(false)
    }
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

        <section className="explorer-results" aria-live="polite">
          <div className="results-heading"><div><p className="eyebrow">OBSERVATION RESULTS</p><h2>{observations ? 'Your data' : 'Ready when you are'}</h2></div>{observations && <span className="result-count">{observations.length.toLocaleString()} ROWS</span>}</div>
          {observationsLoading ? <div className="results-message"><span className="result-spinner" /><strong>Retrieving your data</strong><span>Matching observations are being loaded from the monitoring API.</span></div>
            : error ? <div className="results-message results-message--error"><span className="result-icon">!</span><strong>Couldn’t retrieve observations</strong><span>{error}</span></div>
            : observations === null ? <div className="results-message"><span className="result-icon">↗</span><strong>Set your filters to get started</strong><span>Results will appear here after you select a device, parameter and time period.</span></div>
            : observations.length === 0 ? <div className="results-message"><span className="result-icon">⌕</span><strong>No observations found</strong><span>Try a wider time period or adjust the selected value range.</span></div>
            : <div className="results-summary">
              <div className="summary-mark">✓</div>
              <strong>{observations.length.toLocaleString()} observations retrieved</strong>
              <span>{device?.name} · {parameter?.name.replaceAll('_', ' ')}{parameter?.unit ? ` (${parameter.unit})` : ''}</span>
              <span className="summary-range">{new Date(start).toLocaleString()} — {new Date(end).toLocaleString()}</span>
              <p>Observation data is ready for chart and table visualizations.</p>
              <details className="observation-preview"><summary>Preview first 5 observations</summary><div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Value</th><th>Source UDI</th></tr></thead><tbody>{observations.slice(0, 5).map((item) => <tr key={item.id}><td>{new Date(item.observed_at).toLocaleString()}</td><td>{item.numeric_value ?? item.text_value ?? '—'}{item.numeric_value !== null && parameter?.unit ? ` ${parameter.unit}` : ''}</td><td>{item.source_udi ?? '—'}</td></tr>)}</tbody></table></div></details>
            </div>}
          <div className="results-meta"><span className="status-dot" /> CONNECTED TO SENSOR API <span>·</span> CHRONOLOGICAL ORDER</div>
        </section>
      </div>
    </>
  )
}
