import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLayout } from './components/layout/AppLayout'
import { SensorDataExplorerPage } from './pages/SensorDataExplorerPage'
import './styles.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'

function Application() {
  const { user, logout } = useAuth()
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const navigate = (to: string) => { window.history.pushState({}, '', to); setPath(to) }
  const loginRoute = path === '/login'
  useEffect(() => {
    if (!user && !loginRoute) navigate('/login')
    else if (user && loginRoute) navigate('/')
  }, [user, loginRoute])
  if (!user) return <AppLayout><Header /><LoginPage onSuccess={() => navigate('/')} /></AppLayout>
  return <AppLayout><Header userEmail={user.email} onLogout={logout} /><SensorDataExplorerPage /></AppLayout>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><Application /></AuthProvider></React.StrictMode>,
)
