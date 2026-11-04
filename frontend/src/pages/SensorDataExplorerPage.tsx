import { useEffect, useRef, useState } from 'react'
import { ObservationResults } from '../components/observations/ObservationResults'
import {
  formatParameterName,
  type ObservationQueryContext,
} from '../components/observations/observationFormatters'
import { api } from '../services/api'
import type { DeviceParameter, MonitoringDevice, Observation } from '../types/api'

const PAGE_SIZE = 100

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
  const [query, setQuery] = useState<ObservationQueryContext | null>(null)
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
    api
      .getDevices(controller.signal)
      .then(setDevices)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setDeviceError(reason instanceof Error ? reason.message : 'Unable to load devices.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDevicesLoading(false)
      })
    return () => controller.abort()
  }, [])

  useEffect(
    () => () => {
      devicesRequest.current?.abort()
      parametersRequest.current?.abort()
      observationsRequest.current?.abort()
    },
    [],
  )

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
    setPageOffset(0)
    setHasMore(false)
    setObservationsLoading(false)
    setError('')
    setParameterError('')
    setMinimum('')
    setMaximum('')
    setValidation({})
    if (!selected) return
    const controller = new AbortController()
    parametersRequest.current = controller
    setParametersLoading(true)
    api
      .getDevice(selected.device_uid, controller.signal)
      .then((detail) => setParameters(detail.parameters))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setParameterError(reason instanceof Error ? reason.message : 'Unable to load parameters.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setParametersLoading(false)
      })
  }

  function changeParameter(name: string) {
    observationsRequest.current?.abort()
    requestId.current += 1
    const selected = parameters.find((item) => item.name === name) ?? null
    setParameter(selected)
    setObservations(null)
    setQuery(null)
    setPageOffset(0)
    setHasMore(false)
    setObservationsLoading(false)
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
    if (!start || Number.isNaN(new Date(start).getTime())) {
      issues.start = 'Enter a valid start date and time.'
    }
    if (!end || Number.isNaN(new Date(end).getTime())) {
      issues.end = 'Enter a valid end date and time.'
    }
    if (
      start &&
      end &&
      !Number.isNaN(new Date(start).getTime()) &&
      !Number.isNaN(new Date(end).getTime()) &&
      new Date(start) > new Date(end)
    ) {
      issues.end = 'End must be the same as or later than start.'
    }
    const min = minimum.trim() === '' ? undefined : Number(minimum)
    const max = maximum.trim() === '' ? undefined : Number(maximum)
    if (parameter?.data_type === 'numeric') {
      if (minimum.trim() !== '' && !Number.isFinite(min)) issues.minimum = 'Enter a valid number.'
      if (maximum.trim() !== '' && !Number.isFinite(max)) issues.maximum = 'Enter a valid number.'
      if (
        min !== undefined &&
        max !== undefined &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        min > max
      ) {
        issues.maximum = 'Maximum must be greater than or equal to minimum.'
      }
    }
    setValidation(issues)
    if (Object.keys(issues).length || !device || !parameter) return

    observationsRequest.current?.abort()
    const controller = new AbortController()
    observationsRequest.current = controller
    const currentRequest = ++requestId.current
    const activeQuery: ObservationQueryContext = {
      device,
      parameter,
      start: toUtcIso(start),
      end: toUtcIso(end),
      displayStart: start,
      displayEnd: end,
      ...(parameter.data_type === 'numeric' && min !== undefined ? { minimum: min } : {}),
      ...(parameter.data_type === 'numeric' && max !== undefined ? { maximum: max } : {}),
    }
    setQuery(activeQuery)
    setObservations(null)
    setPageOffset(0)
    setHasMore(false)
    setError('')
    setObservationsLoading(true)
    const filters = {
      parameter: activeQuery.parameter.name,
      start: activeQuery.start,
      end: activeQuery.end,
      ...(activeQuery.minimum !== undefined ? { minValue: activeQuery.minimum } : {}),
      ...(activeQuery.maximum !== undefined ? { maxValue: activeQuery.maximum } : {}),
    }
    try {
      const result = await api.getObservations(
        activeQuery.device.device_uid,
        filters,
        PAGE_SIZE + 1,
        0,
        controller.signal,
      )
      if (currentRequest === requestId.current) {
        setObservations(result.slice(0, PAGE_SIZE))
        setPageOffset(0)
        setHasMore(result.length > PAGE_SIZE)
      }
    } catch (reason) {
      if (!controller.signal.aborted && currentRequest === requestId.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to retrieve observations. Please try again.',
        )
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
      const result = await api.getObservations(
        query.device.device_uid,
        {
          parameter: query.parameter.name,
          start: query.start,
          end: query.end,
          ...(query.minimum !== undefined ? { minValue: query.minimum } : {}),
          ...(query.maximum !== undefined ? { maxValue: query.maximum } : {}),
        },
        PAGE_SIZE + 1,
        offset,
        controller.signal,
      )
      if (currentRequest === requestId.current) {
        setObservations(result.slice(0, PAGE_SIZE))
        setPageOffset(offset)
        setHasMore(result.length > PAGE_SIZE)
      }
    } catch (reason) {
      if (!controller.signal.aborted && currentRequest === requestId.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to retrieve observations. Please try again.',
        )
      }
    } finally {
      if (currentRequest === requestId.current) setObservationsLoading(false)
    }
  }

  return (
    <>
      <section className="welcome-row sensor-page-heading">
        <div>
          <p className="eyebrow">
            DATA EXPLORER <span className="eyebrow-line" />
          </p>
          <h1>Sensor data explorer</h1>
          <p className="intro">
            Choose a device, measurement and time period to retrieve matching observations.
          </p>
        </div>
        <div className="today-chip">
          <span className="live-dot" /> DEMONSTRATION DATA · UTC
        </div>
      </section>

      <div className="explorer-layout">
        <form className="explorer-form" onSubmit={submit} noValidate>
          <div className="form-heading">
            <div>
              <p className="eyebrow">QUERY SETUP</p>
              <h3>Choose what to explore</h3>
            </div>
            <span className="step-count">01 — 04</span>
          </div>

          <div className="explorer-fields">
            <label className="explorer-field explorer-field--wide" htmlFor="monitoring-device">
              Monitoring device
              <select
                id="monitoring-device"
                value={device?.device_uid ?? ''}
                onChange={(event) => changeDevice(event.target.value)}
                disabled={devicesLoading}
                aria-invalid={!!validation.device}
              >
                <option value="">{devicesLoading ? 'Loading devices…' : 'Select a device'}</option>
                {devices.map((item) => (
                  <option key={item.device_uid} value={item.device_uid}>
                    {item.name} · {item.device_uid}
                  </option>
                ))}
              </select>
              {deviceError && (
                <span className="field-error" role="alert">
                  {deviceError}
                </span>
              )}
              {!devicesLoading && !deviceError && devices.length === 0 && (
                <span className="field-hint">No monitoring devices are available yet.</span>
              )}
              {validation.device && (
                <span className="field-error" role="alert">
                  {validation.device}
                </span>
              )}
            </label>

            <label className="explorer-field explorer-field--wide" htmlFor="parameter-select">
              Parameter
              <select
                id="parameter-select"
                value={parameter?.name ?? ''}
                onChange={(event) => changeParameter(event.target.value)}
                disabled={!device || parametersLoading || !!parameterError}
                aria-invalid={!!validation.parameter}
              >
                <option value="">
                  {!device
                    ? 'Select a device first'
                    : parametersLoading
                      ? 'Loading parameters…'
                      : parameterError
                        ? 'Parameters unavailable'
                        : 'Select a parameter'}
                </option>
                {parameters.map((item) => (
                  <option key={item.id} value={item.name}>
                    {formatParameterName(item.name)}
                    {item.unit ? ` · ${item.unit}` : ''} ({item.data_type})
                  </option>
                ))}
              </select>
              {parameterError && (
                <span className="field-error" role="alert">
                  {parameterError}
                </span>
              )}
              {device && !parametersLoading && !parameterError && parameters.length === 0 && (
                <span className="field-hint">This device has no configured parameters.</span>
              )}
              {validation.parameter && (
                <span className="field-error" role="alert">
                  {validation.parameter}
                </span>
              )}
            </label>

            <div className="explorer-field">
              <label htmlFor="range-start">Start date &amp; time</label>
              <input
                id="range-start"
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                aria-invalid={!!validation.start}
              />
              {validation.start && (
                <span className="field-error" role="alert">
                  {validation.start}
                </span>
              )}
            </div>

            <div className="explorer-field">
              <label htmlFor="range-end">End date &amp; time</label>
              <input
                id="range-end"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                aria-invalid={!!validation.end}
              />
              {validation.end && (
                <span className="field-error" role="alert">
                  {validation.end}
                </span>
              )}
            </div>

            {parameter?.data_type === 'numeric' && (
              <>
                <div className="explorer-field">
                  <label htmlFor="minimum-value">
                    Minimum value
                    {parameter.unit && <span className="unit-label">{parameter.unit}</span>}
                  </label>
                  <input
                    id="minimum-value"
                    type="number"
                    step="any"
                    value={minimum}
                    placeholder="No minimum"
                    onChange={(event) => setMinimum(event.target.value)}
                    aria-invalid={!!validation.minimum}
                  />
                  {validation.minimum && (
                    <span className="field-error" role="alert">
                      {validation.minimum}
                    </span>
                  )}
                </div>
                <div className="explorer-field">
                  <label htmlFor="maximum-value">
                    Maximum value
                    {parameter.unit && <span className="unit-label">{parameter.unit}</span>}
                  </label>
                  <input
                    id="maximum-value"
                    type="number"
                    step="any"
                    value={maximum}
                    placeholder="No maximum"
                    onChange={(event) => setMaximum(event.target.value)}
                    aria-invalid={!!validation.maximum}
                  />
                  {validation.maximum && (
                    <span className="field-error" role="alert">
                      {validation.maximum}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="timezone-note">
            <span aria-hidden="true">◷</span>
            <span>Times use your local timezone and are sent to the API in UTC.</span>
          </div>
          <button
            className="primary-button explorer-submit"
            type="submit"
            disabled={observationsLoading || devicesLoading || !!deviceError || !!parameterError}
          >
            {observationsLoading ? (
              <>
                <span className="button-spinner" /> Retrieving observations…
              </>
            ) : (
              <>
                View data <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        <ObservationResults
          observations={observations}
          parameter={query?.parameter ?? null}
          device={query?.device ?? null}
          start={query?.displayStart ?? start}
          end={query?.displayEnd ?? end}
          minimum={query?.minimum}
          maximum={query?.maximum}
          offset={pageOffset}
          pageSize={PAGE_SIZE}
          hasMore={hasMore}
          onPage={loadPage}
          loading={observationsLoading}
          error={error}
        />
      </div>
    </>
  )
}
