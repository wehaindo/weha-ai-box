export interface McpToolProperty {
  type: string
  description?: string
  enum?: string[]
  default?: unknown
  properties?: Record<string, McpToolProperty>
  items?: McpToolProperty
}

export interface McpToolSchema {
  type: "object"
  properties?: Record<string, McpToolProperty>
  required?: string[]
  additionalProperties?: boolean
}

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: McpToolSchema
  outputSchema?: McpToolSchema
}

export interface McpResourceDefinition {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface McpResourceContent {
  uri: string
  mimeType?: string
  text?: string
  structuredContent?: unknown
}

export interface McpToolContent {
  type: "text" | "resource" | "structured"
  text?: string
  resource?: McpResourceContent
  structuredContent?: unknown
}

export interface McpToolResult {
  content: McpToolContent[]
  isError?: boolean
  _meta?: Record<string, unknown>
}

export interface McpListToolsResponse {
  tools: McpToolDefinition[]
  _meta?: Record<string, unknown>
}

export interface McpListResourcesResponse {
  resources: McpResourceDefinition[]
  _meta?: Record<string, unknown>
}

export interface McpRequest {
  jsonrpc?: "2.0"
  id?: string | number
  method: string
  params?: Record<string, unknown>
  _meta?: {
    protocolVersion?: string
    clientInfo?: { name: string; version?: string }
    auth?: string
  }
}

export interface McpSuccessResponse {
  jsonrpc: "2.0"
  id: string | number
  result: unknown
}

export interface McpErrorResponse {
  jsonrpc: "2.0"
  id: string | number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type McpResponse = McpSuccessResponse | McpErrorResponse

export interface McpServerContext {
  tenantDb: any
  tenantId: string
  deviceId?: string
}

export type ToolHandler = (
  ctx: McpServerContext,
  args: Record<string, unknown>
) => Promise<McpToolResult>

export interface RegisteredTool {
  definition: McpToolDefinition
  handler: ToolHandler
}

export interface RegisteredResource {
  definition: McpResourceDefinition
  handler: (ctx: McpServerContext, uri: string) => Promise<McpResourceContent>
}
