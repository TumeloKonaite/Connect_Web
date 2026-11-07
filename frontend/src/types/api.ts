export interface HealthResponse {
  status: string
}

export type ApiConnectionState = 'loading' | 'connected' | 'error'

export interface MonitoringDevice {
  device_uid: string
  name: string
  description: string
}

export interface DeviceParameter {
  id: number
  name: string
  data_type: 'numeric' | 'text'
  unit: string | null
}

export interface MonitoringDeviceDetail extends MonitoringDevice {
  parameters: DeviceParameter[]
}

export interface Observation {
  id: number
  parameter_id: number
  observed_at: string
  numeric_value: number | null
  text_value: string | null
}

export interface ObservationFilters {
  parameter: string
  start: string
  end: string
  minValue?: number
  maxValue?: number
}
