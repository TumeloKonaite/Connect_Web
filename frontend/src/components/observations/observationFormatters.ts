import type { DeviceParameter, MonitoringDevice, Observation } from '../../types/api'

export function formatParameterName(name: string): string {
  const words = name.replaceAll('_', ' ').trim().split(/\s+/)
  return words
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: date.getSeconds() !== 0 ? '2-digit' : undefined,
    hour12: false,
  }).format(date)
}

export function formatAxisTimestamp(ms: number, spanMs: number): string {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return 'Invalid'
  if (spanMs <= 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Object.is(value, -0)) return '0'
  return String(value)
}

export function formatTickValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Object.is(value, -0)) return '0'
  return value.toLocaleString(undefined, { maximumSignificantDigits: 6 })
}

export interface PlottedObservationPoint {
  item: Observation
  date: number
  value: number
}

export function extractValidNumericPoints(observations: Observation[]): PlottedObservationPoint[] {
  if (!Array.isArray(observations)) return []
  return observations
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const date = new Date(item.observed_at).getTime()
      const value = item.numeric_value
      return Number.isFinite(date) && typeof value === 'number' && Number.isFinite(value)
        ? [{ item, date, value }]
        : []
    })
    .sort((a, b) => a.date - b.date || (a.item.id ?? 0) - (b.item.id ?? 0))
}

export function sortTextObservations(observations: Observation[]): Observation[] {
  if (!Array.isArray(observations)) return []
  return [...observations]
    .filter((item): item is Observation => Boolean(item && typeof item === 'object'))
    .sort((a, b) => {
      const aTime = new Date(a.observed_at).getTime()
      const bTime = new Date(b.observed_at).getTime()
      const aValid = Number.isFinite(aTime)
      const bValid = Number.isFinite(bTime)
      if (aValid && bValid && aTime !== bTime) return aTime - bTime
      if (aValid !== bValid) return aValid ? -1 : 1
      return (a.id ?? 0) - (b.id ?? 0)
    })
}

export function computeTimeTicks(firstTime: number, lastTime: number, maxTicks = 4): number[] {
  if (!Number.isFinite(firstTime) || !Number.isFinite(lastTime)) return []
  const span = lastTime - firstTime
  if (span <= 0 || maxTicks <= 1) return [firstTime]
  const count = Math.min(maxTicks, 4)
  const ticks: number[] = []
  for (let i = 0; i < count; i += 1) {
    ticks.push(Math.round(firstTime + (span * i) / (count - 1)))
  }
  return ticks
}

export interface ObservationQueryContext {
  device: MonitoringDevice
  parameter: DeviceParameter
  start: string
  end: string
  displayStart: string
  displayEnd: string
  minimum?: number
  maximum?: number
}

