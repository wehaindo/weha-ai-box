export * from './mcp.js'

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

export interface AgentDefinition {
  id: string
  agentId: string
  code: string
  name: string
  type: string
  description: string | null
  status: string
  version: number
  nodes: AgentNode[]
  edges: AgentEdge[]
  settings: AgentSettings
  metadata: AgentMetadata
  variables: AgentVariable[]
  permissions: AgentPermissions
  outputs: AgentOutput[]
  prompt: string | null
  config: Record<string, any>
  checksum: string
  signature: string | null
  isActive: boolean
  deployedAt: string | null
  createdAt: string
  updatedAt: string
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
  owner?: string
}

export interface AgentVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
  defaultValue?: unknown
  required: boolean
  description?: string
}

export type AgentExecutionType =
  | 'SERVICE' | 'WORKFLOW' | 'REPORT' | 'SQL'
  | 'HTTP' | 'WEBHOOK' | 'COMPOSITE' | 'SCRIPT' | 'APPROVAL'

export type NodeType =
  | 'start' | 'end'
  | 'condition' | 'switch' | 'loop' | 'parallel' | 'delay' | 'wait'
  | 'erp-query' | 'erp-action' | 'workflow-action' | 'approval' | 'task'
  | 'telegram' | 'whotif' | 'email' | 'webhook' | 'push'
  | 'mcp-tool' | 'mcp-workflow'
  | 'reasoning' | 'summary' | 'classification' | 'recommendation'
  | 'forecast' | 'vision' | 'ocr' | 'speech'
  | 'prompt' | 'human_input' | 'knowledge_search' | 'subflow' | 'notification'
  | 'file' | 'database' | 'http' | 'ftp' | 'custom-api'
  | 'script' | 'variable' | 'transform' | 'json' | 'math' | 'date'

export type NodeCategory =
  | 'CORE' | 'BUSINESS' | 'COMMUNICATION' | 'MCP'
  | 'AI' | 'KNOWLEDGE' | 'UTILITY'

export interface AgentNodePosition {
  x: number
  y: number
}

export interface NodeConfig {
  condition?: { expression: string }
  switch?: { cases: { value: string; label: string }[] }
  loop?: { maxIterations: number; iterator?: string }
  parallel?: { completionMode: 'all' | 'any' }
  delay?: { ms: number }
  wait?: { until?: string; timeout?: number }
  prompt?: { template: string; variables?: string[]; model?: string }
  reasoning?: { model?: string; temperature?: number; maxTokens?: number }
  summary?: { model?: string; maxLength?: number }
  classification?: { categories: string[]; model?: string }
  erp_query?: { module: string; action: string; params?: Record<string, any> }
  erp_action?: { module: string; action: string; data?: Record<string, any> }
  workflow_action?: { module: string; transition: string; recordId?: string }
  mcp_tool?: { toolCode: string; params?: Record<string, any> }
  webhook?: { url: string; method: string; headers?: Record<string, string>; body?: string }
  telegram_message?: { template: string; parseMode?: 'HTML' | 'Markdown' }
  email?: { to: string; subject: string; template: string }
  notification?: { type: string; title: string; message: string }
  approval?: { approvalFlowId?: string; message: string }
  human_input?: { prompt: string; timeout?: number; expectedType?: string }
  knowledge_search?: { query: string; maxResults?: number }
  subflow?: { agentCode: string; params?: Record<string, any> }
  database?: { query: string; params?: any[] }
  script?: { code: string; timeout?: number }
  variable?: { operation: 'set' | 'get' | 'delete'; name: string; value?: any }
  transform?: { expression: string }
  math?: { expression: string }
  json?: { operation: 'parse' | 'stringify' | 'merge'; value?: any }
  date?: { operation: 'now' | 'format' | 'parse' | 'add' | 'diff'; value?: any; format?: string }
  [key: string]: any
}

export interface AgentNode {
  id: string
  type: NodeType
  category: NodeCategory
  label: string
  config: NodeConfig
  position?: AgentNodePosition
  description?: string
}

export interface AgentEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  condition?: string
}

export interface AgentPermissions {
  roles: string[]
  users?: string[]
}

export interface AgentSettings {
  model?: string
  temperature?: number
  maxTokens?: number
  maxIterations?: number
  memory?: 'none' | 'conversation' | 'summary'
  rateLimit?: number
  timeout?: number
  retry?: RetryConfig
  errorHandling?: 'fail' | 'retry' | 'continue' | 'fallback' | 'stop' | 'rollback'
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

export const NODE_CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  start:     { label: 'Start',         color: '#22c55e', icon: 'Play' },
  end:       { label: 'End',           color: '#ef4444', icon: 'Square' },
  condition: { label: 'Condition',     color: '#f59e0b', icon: 'GitBranch' },
  switch:    { label: 'Switch',        color: '#f97316', icon: 'GitFork' },
  loop:      { label: 'Loop',          color: '#8b5cf6', icon: 'RefreshCw' },
  parallel:  { label: 'Parallel',      color: '#06b6d4', icon: 'Columns2' },
  delay:     { label: 'Delay',         color: '#6b7280', icon: 'Clock' },
  wait:      { label: 'Wait',          color: '#78716c', icon: 'Hourglass' },
  prompt:    { label: 'Prompt',        color: '#a855f7', icon: 'MessageSquare' },
  reasoning: { label: 'Reasoning',     color: '#7c3aed', icon: 'Brain' },
  summary:   { label: 'Summary',       color: '#6366f1', icon: 'AlignLeft' },
  classification: { label: 'Classification', color: '#4f46e5', icon: 'Tags' },
  'erp-query': { label: 'ERP Query',   color: '#3b82f6', icon: 'Search' },
  'erp-action': { label: 'ERP Action', color: '#2563eb', icon: 'Zap' },
  'workflow-action': { label: 'Workflow', color: '#0284c7', icon: 'GitPullRequest' },
  'mcp-tool': { label: 'MCP Tool',     color: '#0891b2', icon: 'Wrench' },
  'mcp-workflow': { label: 'MCP Workflow', color: '#0e7490', icon: 'GitBranch' },
  webhook:   { label: 'Webhook',       color: '#0d9488', icon: 'Webhook' },
  telegram:  { label: 'Telegram',      color: '#0284c7', icon: 'Send' },
  email:     { label: 'Email',         color: '#dc2626', icon: 'Mail' },
  notification: { label: 'Notification', color: '#059669', icon: 'Bell' },
  push:      { label: 'Push',          color: '#7c3aed', icon: 'BellRing' },
  whotif:    { label: 'Whotif',        color: '#0d9488', icon: 'MessageCircle' },
  approval:  { label: 'Approval',      color: '#dc2626', icon: 'CheckCircle' },
  'human_input': { label: 'Human Input', color: '#f59e0b', icon: 'UserCheck' },
  'knowledge_search': { label: 'Knowledge', color: '#6366f1', icon: 'BookOpen' },
  subflow:   { label: 'Subflow',       color: '#8b5cf6', icon: 'Layers' },
  task:      { label: 'Task',          color: '#3b82f6', icon: 'ClipboardList' },
  variable:  { label: 'Variable',      color: '#6b7280', icon: 'Variable' },
  transform: { label: 'Transform',     color: '#6b7280', icon: 'Shuffle' },
  math:      { label: 'Math',          color: '#6b7280', icon: 'Calculator' },
  json:      { label: 'JSON',          color: '#6b7280', icon: 'Code' },
  date:      { label: 'Date',          color: '#6b7280', icon: 'Calendar' },
  database:  { label: 'Database',      color: '#6b7280', icon: 'Database' },
  script:    { label: 'Script',        color: '#6b7280', icon: 'FileCode' },
  recommendation: { label: 'Recommendation', color: '#4f46e5', icon: 'ThumbsUp' },
  forecast:  { label: 'Forecast',      color: '#4f46e5', icon: 'TrendingUp' },
  vision:    { label: 'Vision',        color: '#7c3aed', icon: 'Camera' },
  ocr:       { label: 'OCR',           color: '#7c3aed', icon: 'ScanText' },
  speech:    { label: 'Speech',        color: '#7c3aed', icon: 'Mic' },
}

export const NODE_GROUPS: { label: string; types: NodeType[] }[] = [
  { label: 'Flow Control',       types: ['start', 'end', 'condition', 'switch', 'loop', 'parallel', 'delay', 'wait'] },
  { label: 'AI',                 types: ['prompt', 'reasoning', 'summary', 'classification', 'recommendation', 'forecast', 'vision', 'ocr', 'speech'] },
  { label: 'ERP & MCP',          types: ['erp-query', 'erp-action', 'workflow-action', 'mcp-tool', 'mcp-workflow'] },
  { label: 'Communication',      types: ['webhook', 'telegram', 'email', 'notification', 'push', 'whotif'] },
  { label: 'Approval & Input',   types: ['approval', 'wait', 'human_input'] },
  { label: 'Data',               types: ['knowledge_search', 'subflow', 'database', 'script'] },
  { label: 'Utility',            types: ['variable', 'transform', 'math', 'json', 'date'] },
  { label: 'Business',           types: ['task'] },
]

// Execution types
export type ExecutionStatus =
  | 'PENDING' | 'RUNNING' | 'PAUSED' | 'WAITING_APPROVAL'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'ROLLED_BACK'
  | 'WAITING_INPUT'

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
  edgeMap?: Map<string, AgentEdge[]>
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
  pauseForInput?: boolean
  routingValue?: string | boolean
  loopContinue?: boolean
  iteration?: number
  tokenUsage?: number
}

export interface ExecutionLogEntry {
  nodeId: string
  nodeType: string
  label: string
  duration: number
  status: 'success' | 'failed' | 'skipped' | 'pending_approval' | 'waiting_input'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  tokenUsage?: number
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
