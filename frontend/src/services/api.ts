import type { HealthResponse, MonitoringDevice, MonitoringDeviceDetail, Observation, ObservationFilters } from '../types/api'

const configuredApiBase = ((import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
// Endpoint paths below already include `/api`. Accept older Compose values
// such as `/api` or `http://localhost:8000/api` without doubling that prefix.
const apiBaseUrl = configuredApiBase.replace(/\/api$/, '')

type AuthUser = { id: number; email: string; is_active: boolean }
export interface DatasetImportResult {
  devices_created: number
  parameters_created: number
  observations_created: number
  rows_imported: number
  rows_skipped: number
  rows_rejected: number
  errors: string[]
}
let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null) { accessToken = token }
export function setUnauthorizedHandler(handler: (() => void) | null) { onUnauthorized = handler }

async function request<T>(
  path: string,
  options: { signal?: AbortSignal; method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(accessToken && path !== '/api/auth/login' ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    })
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
    throw new Error('The service is unavailable. Check your connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') {
      accessToken = null
      onUnauthorized?.()
    }
    const message = response.status === 401
      ? 'Your session has expired. Could not validate credentials. Please sign in again.'
      : response.status >= 500
        ? 'The service is temporarily unavailable. Please try again.'
        : response.status === 404
          ? 'The requested data is no longer available. Refresh your selection and try again.'
          : 'We couldn’t complete that request. Check your selections and try again.'
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  importDataset: (dataset: { devices: unknown[] }) =>
    request<DatasetImportResult>('/api/devices/import', { method: 'POST', body: dataset }),
  login: async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password })
    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      })
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
      throw new Error('Unable to connect to the service. Check your connection and try again.')
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        throw new Error('Incorrect email or password. Check your details and try again.')
      }
      throw new Error('Unable to sign in right now. Please try again.')
    }
    return (await response.json()) as { access_token: string; token_type: string }
  },
  getCurrentUser: () => request<AuthUser>('/api/auth/me'),
  getHealth: (signal?: AbortSignal) => request<HealthResponse>('/api/health', { signal }),
  getDevices: (signal?: AbortSignal) => request<MonitoringDevice[]>('/api/devices', { signal }),
  getDevice: (deviceUid: string, signal?: AbortSignal) =>
    request<MonitoringDeviceDetail>(`/api/devices/${encodeURIComponent(deviceUid)}`, { signal }),
  getObservations: (
    deviceUid: string,
    filters: ObservationFilters,
    limit = 100,
    offset = 0,
    signal?: AbortSignal,
  ): Promise<Observation[]> => {
      const query = new URLSearchParams({
        parameter: filters.parameter,
        start: filters.start,
        end: filters.end,
        limit: String(limit),
        offset: String(offset),
      })
      if (filters.minValue !== undefined) query.set('min_value', String(filters.minValue))
      if (filters.maxValue !== undefined) query.set('max_value', String(filters.maxValue))
      return request<Observation[]>(
        `/api/devices/${encodeURIComponent(deviceUid)}/observations?${query.toString()}`,
        { signal },
      )
  },
}
