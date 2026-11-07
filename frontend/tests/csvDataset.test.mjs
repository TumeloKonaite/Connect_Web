import test from 'node:test'
import assert from 'node:assert/strict'

test('CSV import groups observations and preserves quoted text', async () => {
  const { csvToDataset } = await import('../src/lib/csvDataset.ts')
  const csv = [
    'device_uid,name,description,parameter,data_type,unit,observed_at,numeric_value,text_value',
    'line-1,Line 1,Demo,temp,numeric,C,2026-01-01T00:00:00Z,20,',
    'line-1,Line 1,Demo,state,text,,2026-01-01T00:00:00Z,,"Stopped, maintenance"',
  ].join('\n')
  const dataset = csvToDataset(csv)
  assert.equal(dataset.devices.length, 1)
  assert.equal(dataset.devices[0].parameters.length, 2)
  assert.equal(dataset.devices[0].parameters[1].observations[0].text_value, 'Stopped, maintenance')
})

test('CSV import reports missing headers and invalid values by row', async () => {
  const { csvToDataset } = await import('../src/lib/csvDataset.ts')
  assert.throws(() => csvToDataset('device_uid,name\na,b'), /missing required columns/)
  const csv = [
    'device_uid,name,description,parameter,data_type,unit,observed_at,numeric_value,text_value',
    'line-1,Line 1,,temp,numeric,C,2026-01-01T00:00:00Z,not-a-number,',
  ].join('\n')
  assert.throws(() => csvToDataset(csv), /Row 2: numeric rows require numeric_value/)
})

test('CSV import accepts the bundled demo dataset header names without the legacy source field', async () => {
  const { csvToDataset } = await import('../src/lib/csvDataset.ts')
  const csv = [
    'device_uid,device_name,device_description,parameter_name,data_type,unit,observed_at,numeric_value,text_value',
    'demo-1,Demo device,Sample,temperature,numeric,K,2026-01-01T00:00:00Z,20,',
  ].join('\n')
  const dataset = csvToDataset(csv)
  assert.equal(dataset.devices[0].name, 'Demo device')
  assert.equal(dataset.devices[0].parameters[0].name, 'temperature')
  assert.equal(dataset.devices[0].parameters[0].observations[0].numeric_value, 20)
})
