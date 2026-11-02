import type { ApiConnectionState } from '../../types/api'

interface ApiStatusProps {
  state: ApiConnectionState
  message: string
}

export function ApiStatus({ state, message }: ApiStatusProps) {
  const label = state === 'loading' ? 'Checking' : state === 'connected' ? 'Connected' : 'Unavailable'

  return (
    <div className={`api-status api-status--${state}`} role={state === 'error' ? 'alert' : 'status'}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-copy"><strong>API {label}</strong><span>{message}</span></span>
    </div>
  )
}
