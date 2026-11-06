import type { HealthResponse, MonitoringDevice, MonitoringDeviceDetail, Observation, ObservationFilters } from '../types/api'

const configuredApiBase = ((import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
// Endpoint paths below already include `/api`. Accept older Compose values
// such as `/api` or `http://localhost:8000/api` without doubling that prefix.
const apiBaseUrl = configuredApiBase.replace(/\/api$/, '')

type AuthUser = { id: number; email: string; is_active: boolean }
let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null) { accessToken = token }
export function setUnauthorizedHandler(handler: (() => void) | null) { onUnauthorized = handler }

async function request<T>(
  path: string,
  options: { signal?: AbortSignal; method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(accessToken && path !== '/api/auth/login' ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login') {
      accessToken = null
      onUnauthorized?.()
    }
    let message = `Request failed (${response.status} ${response.statusText})`
    try {
      const payload = (await response.json()) as { detail?: unknown }
      if (typeof payload.detail === 'string') message = payload.detail
      else if (Array.isArray(payload.detail)) {
        message = payload.detail.map((item) => typeof item === 'object' && item && 'msg' in item ? String(item.msg) : String(item)).join('; ')
      }
    } catch { /* Keep the HTTP status message when the response has no JSON body. */ }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  login: async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password })
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    })
    if (!response.ok) {
      let message = 'Unable to log in. Check your email and password.'
      try { const payload = (await response.json()) as { detail?: unknown }; if (typeof payload.detail === 'string') message = payload.detail } catch { /* use fallback */ }
      throw new Error(message)
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
