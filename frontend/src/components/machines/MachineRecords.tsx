import { useCallback, useEffect, useState } from 'react'
import { MachineEntryForm, type MachineEntryMode } from './MachineEntryForm'
import { failureFields } from './machineRecordFields'
import { api } from '../../services/api'
import type { CsvImportResult, MachineRecord, MachineRecordInput } from '../../types/api'

const PAGE_SIZE = 25
const blankRecord: MachineRecordInput = {
  udi: undefined, product_id: '', type: 'L', air_temperature: 298.1,
  process_temperature: 308.6, rotational_speed: 1500, torque: 40, tool_wear: 0,
  machine_failure: false, twf: false, hdf: false, pwf: false, osf: false, rnf: false,
}
export function MachineRecords() {
  const [records, setRecords] = useState<MachineRecord[]>([])
  const [record, setRecord] = useState<MachineRecordInput>({ ...blankRecord })
  const [editingUdi, setEditingUdi] = useState<number | null>(null)
  const [entryMode, setEntryMode] = useState<MachineEntryMode>('single')
  const [viewing, setViewing] = useState<MachineRecord | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingCsv, setUploadingCsv] = useState(false)
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const data = await api.getMachines(PAGE_SIZE, offset, signal)
      setRecords(data)
      setError('')
      if (data.length === 0 && offset > 0) setOffset((current) => Math.max(0, current - PAGE_SIZE))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Could not load machine records.')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    const controller = new AbortController()
    void loadRecords(controller.signal)
    return () => controller.abort()
  }, [loadRecords])

  function updateField<K extends keyof MachineRecordInput>(key: K, value: MachineRecordInput[K]) {
    setRecord((current) => ({ ...current, [key]: value }))
  }
  function resetForm() {
    setEditingUdi(null)
    setRecord({ ...blankRecord })
  }
  function editRecord(item: MachineRecord) {
    setEntryMode('single')
    setEditingUdi(item.udi)
    setRecord({ ...item })
    setNotice('')
    setError('')
    document.getElementById('machine-form-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  async function saveRecord() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingUdi === null) {
        await api.createMachine(record)
        setOffset(0)
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

  async function uploadCsv(file: File): Promise<boolean> {
    setUploadingCsv(true)
    setError('')
    setNotice('')
    setImportResult(null)
    try {
      const result = await api.importCsv(file)
      setImportResult(result)
      setNotice(`${result.inserted} records imported from ${result.filename}.`)
      setOffset(0)
      if (offset === 0) await loadRecords()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the CSV file.')
      return false
    } finally {
      setUploadingCsv(false)
    }
  }

  async function viewRecord(item: MachineRecord) {
    setError('')
    try { setViewing(await api.getMachine(item.udi)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load machine details.') }
  }
  async function removeRecord(item: MachineRecord) {
    if (!window.confirm(`Delete machine record ${item.udi}?`)) return
    setError('')
    setNotice('')
    try {
      await api.deleteMachine(item.udi)
      if (viewing?.udi === item.udi) setViewing(null)
      setNotice(`Machine record ${item.udi} deleted.`)
      await loadRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete machine record.')
    }
  }

  return (
    <section className="machine-workspace" aria-label="Machine records">
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
      {notice && <p className="feedback feedback--success" role="status">{notice}</p>}
      {importResult && <div className={`feedback csv-import-result ${importResult.invalid || importResult.failed ? 'feedback--error' : 'feedback--success'}`} role="status">
        <p>Rows: {importResult.processed} processed · {importResult.inserted} imported · {importResult.duplicate} duplicates · {importResult.invalid} invalid · {importResult.failed} failed.</p>
        {importResult.issues.length > 0 && <ul>{importResult.issues.map((issue, index) => <li key={`${issue.line}-${issue.kind}-${index}`}>Row {issue.line}: {issue.message}</li>)}</ul>}
        {importResult.omitted_issues > 0 && <p>{importResult.omitted_issues} additional row issues omitted.</p>}
      </div>}

      {viewing && <section className="detail-card" aria-labelledby="detail-title"><div className="form-heading"><div><span className="metric-caption">MACHINE RECORD</span><h3 id="detail-title">Record {viewing.udi} · {viewing.product_id}</h3></div><button type="button" className="text-button" onClick={() => setViewing(null)}>Close details</button></div><dl className="detail-grid">{([
        ['UDI', viewing.udi], ['Product ID', viewing.product_id], ['Type', viewing.type], ['Air temperature (K)', viewing.air_temperature], ['Process temperature (K)', viewing.process_temperature], ['Rotational speed (RPM)', viewing.rotational_speed], ['Torque (Nm)', viewing.torque], ['Tool wear (min)', viewing.tool_wear], ...failureFields.map(([key, label]) => [label, viewing[key] ? 'Yes' : 'No']),
      ] as [string, string | number][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}

      <div className="machine-layout">
        <MachineEntryForm
          mode={entryMode}
          editingUdi={editingUdi}
          record={record}
          saving={saving}
          uploadingCsv={uploadingCsv}
          onModeChange={setEntryMode}
          onFieldChange={updateField}
          onSaveRecord={saveRecord}
          onCancelEdit={resetForm}
          onImportCsv={uploadCsv}
        />

        <div className="records-panel"><div className="records-panel-heading"><div><span className="metric-caption">LATEST FROM DATABASE</span><h3>All machines</h3></div><button type="button" className="refresh-button" onClick={() => void loadRecords()}>↻ <span>Refresh</span></button></div>
          {loading ? <p className="table-message" role="status">Loading machine records…</p> : records.length === 0 ? <div className="table-message empty-state"><span aria-hidden="true">⌁</span><strong>No machine records yet</strong><span>Create a record to see it in this list.</span></div> : <div className="table-scroll"><table><thead><tr><th>UDI</th><th>Product ID</th><th>Type</th><th>Air (K)</th><th>Process (K)</th><th>RPM</th><th>Torque</th><th>Wear</th><th>Failure</th><th>Actions</th></tr></thead><tbody>{records.map((item) => <tr key={item.udi}><td className="udi-cell">{item.udi}</td><td>{item.product_id}</td><td><span className={`type-pill type-pill--${item.type.toLowerCase()}`}>{item.type}</span></td><td>{item.air_temperature.toFixed(1)}</td><td>{item.process_temperature.toFixed(1)}</td><td>{item.rotational_speed.toLocaleString()}</td><td>{item.torque.toFixed(1)}</td><td>{item.tool_wear}</td><td><span className={`failure-pill ${item.machine_failure ? 'failure-pill--yes' : 'failure-pill--no'}`}>{item.machine_failure ? 'Yes' : 'No'}</span></td><td><div className="row-actions"><button type="button" onClick={() => void viewRecord(item)} aria-label={`View record ${item.udi}`}>View</button><button type="button" onClick={() => editRecord(item)} aria-label={`Edit record ${item.udi}`}>Edit</button><button type="button" className="delete-action" onClick={() => void removeRecord(item)} aria-label={`Delete record ${item.udi}`}>Delete</button></div></td></tr>)}</tbody></table></div>}
          <div className="table-footer"><span>{records.length ? `Showing ${offset + 1}–${offset + records.length}` : '0 records'} · ordered by UDI</span><nav className="pagination" aria-label="Machine record pages"><button type="button" disabled={offset === 0 || loading} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}>Previous</button><span>Page {Math.floor(offset / PAGE_SIZE) + 1}</span><button type="button" disabled={records.length < PAGE_SIZE || loading} onClick={() => setOffset((current) => current + PAGE_SIZE)}>Next</button></nav></div>
        </div>
      </div>
    </section>
  )
}
