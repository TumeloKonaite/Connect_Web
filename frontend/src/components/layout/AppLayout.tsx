import type { PropsWithChildren } from 'react'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <main className="main-content">{children}</main>
      <footer className="footer">CONNECT WEB <span>·</span> FACTORY SENSOR MONITORING</footer>
    </div>
  )
}
