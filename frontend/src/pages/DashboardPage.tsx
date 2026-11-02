import { ApiStatus } from '../components/status/ApiStatus'
import { useApiHealth } from '../hooks/useApiHealth'

export function DashboardPage() {
  const health = useApiHealth()

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">OVERVIEW <span className="eyebrow-line" /></p>
          <h1>Factory Sensor Monitoring</h1>
          <p className="intro">A clear view of your factory floor starts here.</p>
        </div>
        <div className="today-chip"><span className="live-dot" /> Monitoring workspace</div>
      </section>

      <section className="dashboard-grid" aria-label="Dashboard overview">
        <article className="hero-card">
          <div className="hero-content">
            <span className="card-kicker">YOUR OPERATIONS, IN FOCUS</span>
            <h2>Everything connected.<br />Nothing overlooked.</h2>
            <p>Your sensor insights will come together here. Connect a device to begin monitoring your production environment.</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit art-orbit--outer" />
            <div className="art-orbit art-orbit--inner" />
            <div className="art-core"><span>✳</span></div>
            <i className="art-node art-node--one" /><i className="art-node art-node--two" /><i className="art-node art-node--three" />
          </div>
          <div className="hero-index">01 <span>/</span> 04</div>
        </article>

        <article className="metric-card metric-card--devices">
          <div className="metric-top"><span className="metric-icon metric-icon--green">⌘</span><span className="metric-caption">LIVE INVENTORY</span></div>
          <div className="metric-value">—</div>
          <h3>Connected devices</h3>
          <p>Devices will appear once connected</p>
          <div className="metric-rule"><span /></div>
        </article>

        <article className="metric-card metric-card--signals">
          <div className="metric-top"><span className="metric-icon metric-icon--gold">⌁</span><span className="metric-caption">REAL-TIME READINGS</span></div>
          <div className="metric-value">—</div>
          <h3>Active signals</h3>
          <p>Sensor readings at a glance</p>
          <div className="signal-spark" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
        </article>

        <article className="connection-card">
          <div className="connection-heading"><div><p className="eyebrow">SYSTEM STATUS</p><h3>Backend connection</h3></div><span className="connection-icon">↗</span></div>
          <ApiStatus state={health.state} message={health.message} />
          <div className="endpoint"><span>HEALTH ENDPOINT</span><code>/health</code></div>
        </article>

        <article className="empty-card">
          <div className="empty-symbol" aria-hidden="true"><span>⌁</span></div>
          <div><span className="metric-caption">YOUR SENSOR DATA</span><h3>Insights will show up here</h3><p>Once your devices are online, this space will bring your factory data to life.</p></div>
          <span className="empty-arrow" aria-hidden="true">↗</span>
        </article>
      </section>
    </>
  )
}
