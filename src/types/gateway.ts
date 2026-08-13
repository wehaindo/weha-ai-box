/** Envelope the box publishes to `tenant.{t}.device.{id}.event` over NATS. */
export interface NatsDeviceEnvelope {
  type: 'HEARTBEAT' | 'EVENT' | 'TASK_RESULT' | 'TASK_PROGRESS' | 'ERROR' | 'PING' | 'PONG'
  deviceId?: string
  boxId?: string
  tenantId?: string
  timestamp?: string
  data?: Record<string, any> | null
}

/** Command the box receives on `tenant.{t}.device.{id}.command` (both shapes). */
export interface NatsDeviceCommand {
  id?: string
  cmdId?: string
  type: string
  payload?: Record<string, any> | null
  correlationId?: string
  issuedAt?: string
}
