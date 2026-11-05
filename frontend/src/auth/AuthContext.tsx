import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { api, setAccessToken, setUnauthorizedHandler } from '../services/api'

type User = { id: number; email: string; is_active: boolean }
type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const logout = useCallback(() => { setAccessToken(null); setUser(null); window.history.replaceState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')) }, [])
  useEffect(() => { setUnauthorizedHandler(logout); return () => setUnauthorizedHandler(null) }, [logout])
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const token = await api.login(email, password)
      setAccessToken(token.access_token)
      const currentUser = await api.getCurrentUser()
      setUser(currentUser)
    } catch (error) { setAccessToken(null); setUser(null); throw error }
    finally { setLoading(false) }
  }, [])
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
