import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLayout } from './components/layout/AppLayout'
import { SensorDataExplorerPage } from './pages/SensorDataExplorerPage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppLayout>
      <SensorDataExplorerPage />
    </AppLayout>
  </React.StrictMode>,
)
