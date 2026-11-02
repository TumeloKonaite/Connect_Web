import type { HealthResponse } from '../types/api'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`API request failed (${response.status} ${response.statusText})`)
  }

  return (await response.json()) as T
}

export const api = {
  getHealth: (signal?: AbortSignal) => request<HealthResponse>('/health', signal),
}
