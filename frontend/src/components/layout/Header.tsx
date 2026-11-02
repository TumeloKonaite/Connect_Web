export function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Connect Web dashboard">
        <span className="brand-mark" aria-hidden="true">C</span>
        <span className="brand-name">connect<span>web</span></span>
      </a>
      <div className="topbar-label">FACTORY MONITORING</div>
      <div className="user-badge" aria-label="Workspace">CW</div>
    </header>
  )
}
