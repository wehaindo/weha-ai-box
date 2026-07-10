import { z } from 'zod'
import crypto from 'crypto'
import type { AgentJson, AgentNode, AgentEdge, AgentVariable, AgentOutput, AgentSettings, RetryConfig } from '../../types/index.js'

const variableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'any']),
  defaultValue: z.unknown().optional(),
  required: z.boolean().default(false),
  description: z.string().optional(),
}).passthrough()

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.string(),
  label: z.string(),
  config: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
}).passthrough()

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  condition: z.string().optional(),
}).passthrough()

const retryConfigSchema = z.object({
  maxAttempts: z.number().min(1).default(3),
  backoff: z.enum(['fixed', 'exponential']).default('fixed'),
  delayMs: z.number().min(0).default(1000),
})

const settingsSchema = z.object({
  timeout: z.number().optional(),
  retry: retryConfigSchema.optional(),
  errorHandling: z.enum(['stop', 'continue', 'rollback']).default('stop'),
  logging: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
}).passthrough()

const outputSchema = z.object({
  name: z.string(),
  type: z.string(),
  source: z.string(),
}).passthrough()

const agentJsonSchema = z.object({
  agent: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    version: z.number(),
  }),
  metadata: z.object({
    author: z.string().optional(),
    created: z.string().optional(),
    updated: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
  }).passthrough(),
  variables: z.array(variableSchema).default([]),
  nodes: z.array(nodeSchema).min(2),
  edges: z.array(edgeSchema).min(1),
  permissions: z.object({
    roles: z.array(z.string()),
    users: z.array(z.string()).optional(),
  }).passthrough().default({ roles: ['ADMIN'] }),
  settings: settingsSchema.default({}),
  outputs: z.array(outputSchema).default([]),
  version: z.number(),
  checksum: z.string(),
  signature: z.string().optional(),
})

export interface ParseResult {
  success: true
  agent: AgentJson
}

export interface ParseError {
  success: false
  errors: string[]
}

export function parseAgentJson(input: unknown): ParseResult | ParseError {
  const result = agentJsonSchema.safeParse(input)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    }
  }

  const agent = result.data as AgentJson

  const computedChecksum = computeChecksum(input as Record<string, unknown>)
  if (computedChecksum !== agent.checksum) {
    return {
      success: false,
      errors: [`Checksum mismatch: expected ${agent.checksum}, computed ${computedChecksum}`],
    }
  }

  return { success: true, agent }
}

export function validateAgentStructure(input: unknown): ParseResult | ParseError {
  const result = agentJsonSchema.safeParse(input)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    }
  }

  return { success: true, agent: result.data as AgentJson }
}

export function computeChecksum(agent: Record<string, unknown>): string {
  const { signature, checksum, ...content } = agent
  const sorted = Object.keys(content).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = content[key]
    return acc
  }, {})
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}
