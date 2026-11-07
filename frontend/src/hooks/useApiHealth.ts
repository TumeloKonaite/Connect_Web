import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { ApiConnectionState, HealthResponse } from '../types/api'

interface ApiHealth {
  state: ApiConnectionState
  message: string
  data: HealthResponse | null
}

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>({
    state: 'loading',
    message: 'Checking backend connection…',
    data: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    api
      .getHealth(controller.signal)
      .then((data) => {
        setHealth({ state: 'connected', message: 'Backend is reachable', data })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setHealth({
          state: 'error',
          message: 'Unable to reach the backend. Check that it is running, then reload to reconnect.',
          data: null,
        })
      })

    return () => controller.abort()
  }, [])

  return health
}
