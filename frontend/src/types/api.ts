export interface HealthResponse {
  status: string
}

export interface MachineRecord {
  udi: number
  product_id: string
  type: 'L' | 'M' | 'H'
  air_temperature: number
  process_temperature: number
  rotational_speed: number
  torque: number
  tool_wear: number
  machine_failure: boolean
  twf: boolean
  hdf: boolean
  pwf: boolean
  osf: boolean
  rnf: boolean
}

export type MachineRecordInput = Omit<MachineRecord, 'udi'> & { udi?: number }

export type ApiConnectionState = 'loading' | 'connected' | 'error'
