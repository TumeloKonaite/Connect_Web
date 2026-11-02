import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  </React.StrictMode>,
)
