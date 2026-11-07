type CsvRow = Record<string, string>

const COLUMNS = [
  'device_uid', 'name', 'description', 'parameter', 'data_type', 'unit',
  'observed_at', 'numeric_value', 'text_value',
]
const HEADER_ALIASES: Record<string, string> = {
  device_name: 'name',
  device_description: 'description',
  parameter_name: 'parameter',
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export function csvToDataset(text: string): { devices: unknown[] } {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('Choose a CSV with a header row and at least one observation.')
  const headers = rows[0].map((header, index) => {
    const normalized = (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim().toLowerCase()
    return HEADER_ALIASES[normalized] ?? normalized
  })
  const missing = COLUMNS.filter((column) => !headers.includes(column))
  if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`)
  const devices = new Map<string, { device_uid: string; name: string; description: string | null; parameters: Map<string, { name: string; data_type: string; unit: string | null; observations: Record<string, unknown>[] }> }>()

  rows.slice(1).forEach((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has ${values.length} values; expected ${headers.length}.`)
    const row = Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex].trim()])) as CsvRow
    const fail = (message: string): never => { throw new Error(`Row ${index + 2}: ${message}`) }
    if (!row.device_uid || !row.name || !row.parameter) fail('device_uid, name, and parameter are required.')
    if (row.data_type !== 'numeric' && row.data_type !== 'text') fail('data_type must be numeric or text.')
    const date = new Date(row.observed_at)
    if (!row.observed_at || Number.isNaN(date.getTime()) || !/(Z|[+-]\d{2}:?\d{2})$/i.test(row.observed_at)) fail('observed_at must be an ISO timestamp with a timezone.')
    const device = devices.get(row.device_uid) ?? {
      device_uid: row.device_uid, name: row.name, description: row.description || null,
      parameters: new Map(),
    }
    if (device.name !== row.name || device.description !== (row.description || null)) fail('device name and description must be consistent across rows.')
    const parameter = device.parameters.get(row.parameter) ?? {
      name: row.parameter, data_type: row.data_type, unit: row.unit || null, observations: [],
    }
    if (parameter.data_type !== row.data_type || parameter.unit !== (row.unit || null)) fail('parameter type and unit must be consistent across rows.')
    const observation: Record<string, unknown> = { observed_at: date.toISOString(), numeric_value: null, text_value: null }
    if (row.data_type === 'numeric') {
      const value = Number(row.numeric_value)
      if (!row.numeric_value || !Number.isFinite(value) || row.text_value) fail('numeric rows require numeric_value and an empty text_value.')
      observation.numeric_value = value
    } else {
      if (!row.text_value || row.numeric_value) fail('text rows require text_value and an empty numeric_value.')
      observation.text_value = row.text_value
    }
    parameter.observations.push(observation)
    device.parameters.set(row.parameter, parameter)
    devices.set(row.device_uid, device)
  })

  return { devices: [...devices.values()].map((device) => ({
    ...device,
    parameters: [...device.parameters.values()].map((parameter) => ({
      ...parameter,
      observations: parameter.observations.sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at))),
    })),
  })) }
}
