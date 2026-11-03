import { MachineRecords } from '../components/machines/MachineRecords'
import { ApiStatus } from '../components/status/ApiStatus'
import { useApiHealth } from '../hooks/useApiHealth'

export function DashboardPage() {
  const health = useApiHealth()

  return (
    <>
      <section className="welcome-row machine-page-heading">
        <div>
          <p className="eyebrow">PRODUCTION DATA <span className="eyebrow-line" /></p>
          <h1>Machine records</h1>
          <p className="intro">Browse measurements and manage machine records from your production dataset.</p>
        </div>
        <ApiStatus state={health.state} message={health.message} />
      </section>
      <MachineRecords />
    </>
  )
}
