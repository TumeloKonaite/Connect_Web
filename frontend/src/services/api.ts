import type { HealthResponse, MachineRecord, MachineRecordInput } from '../types/api'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(
  path: string,
  options: { signal?: AbortSignal; method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`API request failed (${response.status} ${response.statusText})`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  getHealth: (signal?: AbortSignal) => request<HealthResponse>('/api/health', { signal }),
  getMachines: (signal?: AbortSignal) => request<MachineRecord[]>('/api/machines', { signal }),
  createMachine: (record: MachineRecordInput) =>
    request<MachineRecord>('/api/machines', { method: 'POST', body: record }),
  updateMachine: (udi: number, changes: Partial<MachineRecordInput>) =>
    request<MachineRecord>(`/api/machines/${udi}`, { method: 'PATCH', body: changes }),
  deleteMachine: (udi: number) =>
    request<void>(`/api/machines/${udi}`, { method: 'DELETE' }),
}
