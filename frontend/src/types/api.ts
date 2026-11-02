export interface HealthResponse {
  status: string
}

export type ApiConnectionState = 'loading' | 'connected' | 'error'
