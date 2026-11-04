import { useState, type FormEvent } from 'react'
import type { MachineRecord, MachineRecordInput } from '../../types/api'
import { failureFields } from './machineRecordFields'

export type MachineEntryMode = 'single' | 'bulk'

interface MachineEntryFormProps {
  mode: MachineEntryMode
  editingUdi: number | null
  record: MachineRecordInput
  saving: boolean
  uploadingCsv: boolean
  onModeChange: (mode: MachineEntryMode) => void
  onFieldChange: <K extends keyof MachineRecordInput>(
    key: K,
    value: MachineRecordInput[K],
  ) => void
  onSaveRecord: () => void
  onCancelEdit: () => void
  onImportCsv: (file: File) => Promise<boolean>
}

export function MachineEntryForm({
  mode,
  editingUdi,
  record,
  saving,
  uploadingCsv,
  onModeChange,
  onFieldChange,
  onSaveRecord,
  onCancelEdit,
  onImportCsv,
}: MachineEntryFormProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null)

  function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSaveRecord()
  }

  async function submitCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!csvFile) return
    if (await onImportCsv(csvFile)) {
      setCsvFile(null)
      form.reset()
    }
  }

  return (
    <section className="machine-form" aria-labelledby="machine-form-title">
      <div className="form-heading">
        <div>
          <span className="metric-caption">RECORD DETAILS</span>
          <h3 id="machine-form-title">
            {mode === 'single' && editingUdi !== null
              ? `Edit record ${editingUdi}`
              : mode === 'single'
                ? 'Add a machine'
                : 'Bulk addition'}
          </h3>
        </div>
        {editingUdi !== null && mode === 'single' && (
          <button type="button" className="text-button" onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>

      <div className="entry-tabs" role="tablist" aria-label="Machine record entry mode">
        <button
          id="single-entry-tab"
          type="button"
          role="tab"
          aria-selected={mode === 'single'}
          aria-controls="single-entry-panel"
          className={mode === 'single' ? 'entry-tab entry-tab--active' : 'entry-tab'}
          onClick={() => onModeChange('single')}
        >
          Single record
        </button>
        <button
          id="bulk-entry-tab"
          type="button"
          role="tab"
          aria-selected={mode === 'bulk'}
          aria-controls="bulk-entry-panel"
          className={mode === 'bulk' ? 'entry-tab entry-tab--active' : 'entry-tab'}
          disabled={editingUdi !== null}
          onClick={() => onModeChange('bulk')}
        >
          Bulk CSV
        </button>
      </div>

      {mode === 'single' ? (
        <form
          id="single-entry-panel"
          className="entry-panel form-panel"
          role="tabpanel"
          aria-labelledby="single-entry-tab"
          onSubmit={submitRecord}
        >
          <div className="form-grid">
            {editingUdi === null && (
              <label>
                UDI
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={record.udi ?? ''}
                  onChange={(event) =>
                    onFieldChange('udi', event.target.value ? Number(event.target.value) : undefined)
                  }
                />
              </label>
            )}
            <label>
              Product ID
              <input
                id="product-id"
                required
                minLength={1}
                value={record.product_id}
                onChange={(event) => onFieldChange('product_id', event.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={record.type}
                onChange={(event) => onFieldChange('type', event.target.value as MachineRecord['type'])}
              >
                <option value="L">L · Low</option>
                <option value="M">M · Medium</option>
                <option value="H">H · High</option>
              </select>
            </label>
            <label>
              Air temperature (K)
              <input
                type="number"
                step="any"
                required
                value={record.air_temperature}
                onChange={(event) => onFieldChange('air_temperature', Number(event.target.value))}
              />
            </label>
            <label>
              Process temperature (K)
              <input
                type="number"
                step="any"
                required
                value={record.process_temperature}
                onChange={(event) => onFieldChange('process_temperature', Number(event.target.value))}
              />
            </label>
            <label>
              Rotational speed (RPM)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={record.rotational_speed}
                onChange={(event) => onFieldChange('rotational_speed', Number(event.target.value))}
              />
            </label>
            <label>
              Torque (Nm)
              <input
                type="number"
                min="0"
                step="any"
                required
                value={record.torque}
                onChange={(event) => onFieldChange('torque', Number(event.target.value))}
              />
            </label>
            <label>
              Tool wear (min)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={record.tool_wear}
                onChange={(event) => onFieldChange('tool_wear', Number(event.target.value))}
              />
            </label>
          </div>
          <fieldset className="failure-fields">
            <legend>Failure indicators</legend>
            {failureFields.map(([key, label]) => (
              <label className="checkbox-label" key={key}>
                <input
                  type="checkbox"
                  checked={record[key]}
                  onChange={(event) => onFieldChange(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingUdi === null ? 'Create record' : 'Save changes'}
          </button>
        </form>
      ) : (
        <form
          id="bulk-entry-panel"
          className="entry-panel bulk-entry-panel"
          role="tabpanel"
          aria-labelledby="bulk-entry-tab"
          onSubmit={submitCsv}
        >
          <p>Import many machine records from a CSV file. Existing UDIs are skipped.</p>
          <label className="bulk-file-picker">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              required
              onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className="bulk-file-hint">UTF-8 CSV · up to 5 MiB and 10,000 rows</span>
          <button className="primary-button" type="submit" disabled={uploadingCsv || !csvFile}>
            {uploadingCsv ? 'Uploading…' : 'Upload CSV'}
          </button>
        </form>
      )}
    </section>
  )
}
