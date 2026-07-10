// Agent JSON types
export interface AgentJson {
  agent: AgentMetadata
  metadata: AgentMetadata
  variables: AgentVariable[]
  nodes: AgentNode[]
  edges: AgentEdge[]
  permissions: AgentPermissions
  settings: AgentSettings
  outputs: AgentOutput[]
  version: number
  checksum: string
  signature?: string
}

export interface AgentMetadata {
  id: string
  name: string
  description?: string
  version: number
  author?: string
  created?: string
  updated?: string
  tags?: string[]
  category?: string
}

export interface AgentVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  defaultValue?: unknown
  required: boolean
  description?: string
}

export interface AgentNode {
  id: string
  type: NodeType
  category: NodeCategory
  label: string
  config: Record<string, unknown>
  position?: { x: number; y: number }
}

export type NodeType =
  | 'start' | 'end'
  | 'condition' | 'switch' | 'loop' | 'parallel' | 'delay' | 'wait'
  | 'erp-query' | 'erp-action' | 'workflow-action' | 'approval' | 'task'
  | 'telegram' | 'whotif' | 'email' | 'webhook' | 'push'
  | 'mcp-tool' | 'mcp-workflow'
  | 'reasoning' | 'summary' | 'classification' | 'recommendation'
  | 'forecast' | 'vision' | 'ocr' | 'speech'
  | 'file' | 'database' | 'http' | 'ftp' | 'custom-api'
  | 'script' | 'variable' | 'transform' | 'json' | 'math' | 'date'

export type NodeCategory =
  | 'CORE' | 'BUSINESS' | 'COMMUNICATION' | 'MCP'
  | 'AI' | 'KNOWLEDGE' | 'UTILITY'

export interface AgentEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export interface AgentPermissions {
  roles: string[]
  users?: string[]
}

export interface AgentSettings {
  timeout?: number
  retry?: RetryConfig
  errorHandling?: 'stop' | 'continue' | 'rollback'
  logging?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
}

export interface RetryConfig {
  maxAttempts: number
  backoff: 'fixed' | 'exponential'
  delayMs: number
}

export interface AgentOutput {
  name: string
  type: string
  source: string
}

// Execution types
export type ExecutionStatus =
  | 'PENDING' | 'RUNNING' | 'PAUSED' | 'WAITING_APPROVAL'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ROLLED_BACK'

export type TriggerType =
  | 'MANUAL' | 'SCHEDULED' | 'EVENT' | 'WEBHOOK' | 'ERP'

export interface ExecutionContext {
  executionId: string
  agentId: string
  trigger: TriggerType
  input: Record<string, unknown>
  variables: Record<string, unknown>
  nodeId: string
  node: AgentNode
  edges: AgentEdge[]
  checkpoints: Checkpoint[]
  config: AgentSettings
}

export interface Checkpoint {
  id: string
  executionId: string
  nodeId: string
  nodeType: string
  state: Record<string, unknown>
  variables: Record<string, unknown>
  createdAt: string
}

export interface NodeResult {
  success: boolean
  output?: Record<string, unknown>
  error?: string
  nextNodeId?: string
  pauseForApproval?: boolean
}

// Plugin types
export type PluginType =
  | 'ERP' | 'MCP' | 'NOTIFICATION' | 'AI'
  | 'STORAGE' | 'AUTHENTICATION' | 'COMMUNICATION'

export type PluginStatus =
  | 'INSTALLED' | 'ACTIVE' | 'INACTIVE' | 'ERROR'

export interface PluginManifest {
  id: string
  name: string
  version: string
  type: PluginType
  description: string
  author?: string
  capabilities: string[]
  permissions: string[]
  dependencies?: Record<string, string>
  configSchema: Record<string, unknown>
  healthCheck: {
    endpoint: string
    interval: number
    timeout: number
  }
}

// Device config types (from weha-boilerplate-device)
export interface DeviceConfig {
  serverUrl: string
  deviceToken: string
  tenantId: string
  deviceId: string
  deviceName: string
  deviceCode: string
  deviceType: string
  storeName: string
  scopes: string[]
  registeredAt: string
  deviceConfig: Record<string, unknown> | null
  deviceConfigSyncedAt: string
  // AI Box specific extensions
  runtimeUrl?: string
  agentSyncEnabled?: boolean
  aiEnabled?: boolean
  localAiModel?: string
}

// Auth types
export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER'

// AI types
export type AiProvider =
  | 'local' | 'openai' | 'gemini' | 'anthropic' | 'azure'

export interface AiUsageRecord {
  provider: AiProvider
  model: string
  tokensIn: number
  tokensOut: number
  creditsUsed: number
  duration: number
  agentId?: string
  executionId?: string
  userId?: string
}
