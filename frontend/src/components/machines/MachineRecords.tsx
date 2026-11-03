import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../../services/api'
import type { MachineRecord, MachineRecordInput } from '../../types/api'

const blankRecord: MachineRecordInput = {
  udi: undefined,
  product_id: '',
  type: 'L',
  air_temperature: 298.1,
  process_temperature: 308.6,
  rotational_speed: 1500,
  torque: 40,
  tool_wear: 0,
  machine_failure: false,
  twf: false,
  hdf: false,
  pwf: false,
  osf: false,
  rnf: false,
}

export function MachineRecords() {
  const [records, setRecords] = useState<MachineRecord[]>([])
  const [record, setRecord] = useState<MachineRecordInput>(blankRecord)
  const [editingUdi, setEditingUdi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await api.getMachines(signal)
      setRecords(data)
      setError('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Could not load machine records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadRecords(controller.signal)
    return () => controller.abort()
  }, [loadRecords])

  function updateField<K extends keyof MachineRecordInput>(key: K, value: MachineRecordInput[K]) {
    setRecord((current) => ({ ...current, [key]: value }))
  }

  function editRecord(item: MachineRecord) {
    setEditingUdi(item.udi)
    setRecord({ ...item })
    setNotice('')
    setError('')
    document.getElementById('machine-form-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function resetForm() {
    setEditingUdi(null)
    setRecord(blankRecord)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingUdi === null) {
        await api.createMachine(record)
        setNotice('Machine record created.')
      } else {
        const changes = { ...record }
        delete changes.udi
        await api.updateMachine(editingUdi, changes)
        setNotice('Machine record updated.')
      }
      resetForm()
      await loadRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save machine record.')
    } finally {
      setSaving(false)
    }
  }

  async function removeRecord(item: MachineRecord) {
    if (!window.confirm(`Delete machine record ${item.udi}?`)) return
    setError('')
    setNotice('')
    try {
      await api.deleteMachine(item.udi)
      setRecords((current) => current.filter((entry) => entry.udi !== item.udi))
      setNotice(`Machine record ${item.udi} deleted.`)
      if (editingUdi === item.udi) resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete machine record.')
    }
  }

  return (
    <section className="machine-workspace" aria-labelledby="machines-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PRODUCTION DATA <span className="eyebrow-line" /></p>
          <h2 id="machines-title">Machine records</h2>
          <p className="section-intro">Review sensor readings and manage machine records.</p>
        </div>
        <span className="record-count">{records.length} {records.length === 1 ? 'RECORD' : 'RECORDS'}</span>
      </div>

      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
      {notice && <p className="feedback feedback--success" role="status">{notice}</p>}

      <div className="machine-layout">
        <form className="machine-form" onSubmit={submit}>
          <div className="form-heading">
            <div><span className="metric-caption">RECORD DETAILS</span><h3 id="machine-form-title">{editingUdi === null ? 'Add a machine' : `Edit record ${editingUdi}`}</h3></div>
            {editingUdi !== null && <button type="button" className="text-button" onClick={resetForm}>Cancel</button>}
          </div>
          <div className="form-grid">
            {editingUdi === null && <label>UDI<input type="number" min="1" required value={record.udi ?? ''} onChange={(event) => updateField('udi', event.target.value ? Number(event.target.value) : undefined)} /></label>}
            <label>Product ID<input required value={record.product_id} onChange={(event) => updateField('product_id', event.target.value)} /></label>
            <label>Type<select value={record.type} onChange={(event) => updateField('type', event.target.value as MachineRecord['type'])}><option value="L">L · Low</option><option value="M">M · Medium</option><option value="H">H · High</option></select></label>
            <label>Air temperature (K)<input type="number" step="any" required value={record.air_temperature} onChange={(event) => updateField('air_temperature', Number(event.target.value))} /></label>
            <label>Process temperature (K)<input type="number" step="any" required value={record.process_temperature} onChange={(event) => updateField('process_temperature', Number(event.target.value))} /></label>
            <label>Rotational speed (RPM)<input type="number" min="0" required value={record.rotational_speed} onChange={(event) => updateField('rotational_speed', Number(event.target.value))} /></label>
            <label>Torque (Nm)<input type="number" min="0" step="any" required value={record.torque} onChange={(event) => updateField('torque', Number(event.target.value))} /></label>
            <label>Tool wear (min)<input type="number" min="0" required value={record.tool_wear} onChange={(event) => updateField('tool_wear', Number(event.target.value))} /></label>
          </div>
          <fieldset className="failure-fields">
            <legend>Failure indicators</legend>
            {([['machine_failure', 'Machine failure'], ['twf', 'Tool wear'], ['hdf', 'Heat dissipation'], ['pwf', 'Power'], ['osf', 'Overstrain'], ['rnf', 'Random']] as const).map(([key, label]) => (
              <label className="checkbox-label" key={key}><input type="checkbox" checked={record[key]} onChange={(event) => updateField(key, event.target.checked)} />{label}</label>
            ))}
          </fieldset>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingUdi === null ? 'Create record' : 'Save changes'}</button>
        </form>

        <div className="records-panel">
          <div className="records-panel-heading"><div><span className="metric-caption">LATEST FROM DATABASE</span><h3>All machines</h3></div><button type="button" className="refresh-button" onClick={() => { setLoading(true); void loadRecords() }}>↻ <span>Refresh</span></button></div>
          {loading ? <p className="table-message">Loading machine records…</p> : records.length === 0 ? <div className="table-message empty-state"><span aria-hidden="true">⌁</span><strong>No machine records yet</strong><span>Create a record to see it in this list.</span></div> : (
            <div className="table-scroll"><table><thead><tr><th>UDI</th><th>Product</th><th>Type</th><th>Air (K)</th><th>Process (K)</th><th>Speed</th><th>Torque</th><th>Wear</th><th>Failure</th><th>Actions</th></tr></thead><tbody>
              {records.map((item) => <tr key={item.udi}><td className="udi-cell">{item.udi}</td><td>{item.product_id}</td><td><span className={`type-pill type-pill--${item.type.toLowerCase()}`}>{item.type}</span></td><td>{item.air_temperature.toFixed(1)}</td><td>{item.process_temperature.toFixed(1)}</td><td>{item.rotational_speed.toLocaleString()}</td><td>{item.torque.toFixed(1)}</td><td>{item.tool_wear}</td><td><span className={`failure-pill ${item.machine_failure ? 'failure-pill--yes' : 'failure-pill--no'}`}>{item.machine_failure ? 'Failure' : 'Normal'}</span></td><td><div className="row-actions"><button type="button" onClick={() => editRecord(item)} aria-label={`Edit record ${item.udi}`}>Edit</button><button type="button" className="delete-action" onClick={() => void removeRecord(item)} aria-label={`Delete record ${item.udi}`}>Delete</button></div></td></tr>)}
            </tbody></table></div>
          )}
          <div className="table-footer"><span>Ordered by UDI</span><span>{records.length} shown</span></div>
        </div>
      </div>
    </section>
  )
}
