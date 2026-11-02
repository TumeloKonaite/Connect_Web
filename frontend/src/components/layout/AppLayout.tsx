import type { PropsWithChildren } from 'react'
import { Header } from './Header'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content">{children}</main>
      <footer className="footer">CONNECT WEB <span>·</span> FACTORY SENSOR MONITORING</footer>
    </div>
  )
}
