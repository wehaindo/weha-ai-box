import { env } from '../../config/env.js'
import { databaseService } from '../database/database.service.js'

export interface LlmConfig {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface FunctionToolParameter {
  type: string
  description?: string
  enum?: string[]
  default?: unknown
  properties?: Record<string, FunctionToolParameter>
  items?: FunctionToolParameter
  required?: string[]
}

export interface FunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: FunctionToolParameter
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface CompletionRequest {
  system?: string
  messages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string; tool_calls?: ToolCall[] }[]
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: FunctionTool[]
  toolChoice?: string | Record<string, unknown>
}

export interface CompletionResponse {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number }
  toolCalls?: ToolCall[]
}

export interface LlmProviderConfig {
  apiKey: string
  baseUrl: string
  model: string
  fallbackApiKey?: string
  fallbackBaseUrl?: string
  fallbackModel?: string
}

class LlmProvider {
  private baseUrl: string = 'https://api.openai.com/v1'
  private apiKey: string = ''
  private defaultModel: string = 'gpt-4o-mini'
  private fallbackUrl?: string
  private fallbackKey?: string
  private fallbackModel?: string
  private simulated: boolean = true

  constructor() {
    this.applyEnvFallback()
  }

  private applyEnvFallback() {
    if (!this.apiKey) this.apiKey = env.LLM_API_KEY || ''
    if (this.baseUrl === 'https://api.openai.com/v1') this.baseUrl = env.LLM_BASE_URL || 'https://api.openai.com/v1'
    if (this.defaultModel === 'gpt-4o-mini') this.defaultModel = env.LLM_MODEL || 'gpt-4o-mini'
    if (!this.fallbackUrl) this.fallbackUrl = env.LLM_FALLBACK_URL
    if (!this.fallbackKey) this.fallbackKey = env.LLM_FALLBACK_KEY
    if (!this.fallbackModel) this.fallbackModel = env.LLM_FALLBACK_MODEL
    this.simulated = !this.apiKey && !this.fallbackKey
  }

  getConfig(): LlmProviderConfig {
    return {
      apiKey: this.apiKey ? '••••' + this.apiKey.slice(-4) : '',
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      fallbackApiKey: this.fallbackKey ? '••••' + this.fallbackKey.slice(-4) : '',
      fallbackBaseUrl: this.fallbackUrl || '',
      fallbackModel: this.fallbackModel || '',
    }
  }

  getStatus(): { configured: boolean; simulated: boolean; provider: string; model: string } {
    return {
      configured: !!this.apiKey,
      simulated: this.simulated,
      provider: this.baseUrl.includes('localhost') ? 'ollama' : this.baseUrl.includes('openai') ? 'openai' : 'custom',
      model: this.defaultModel,
    }
  }

  async loadConfig() {
    try {
      const db = databaseService.getClient()
      const getVal = async (key: string): Promise<string | undefined> => {
        const row = await (db as any).appConfig.findUnique({ where: { key } })
        return row?.value || undefined
      }

      const apiKey = await getVal('llm_api_key')
      const baseUrl = await getVal('llm_base_url')
      const model = await getVal('llm_model')
      const fallbackKey = await getVal('llm_fallback_api_key')
      const fallbackUrl = await getVal('llm_fallback_base_url')
      const fallbackModel = await getVal('llm_fallback_model')

      if (apiKey) this.apiKey = apiKey
      if (baseUrl) this.baseUrl = baseUrl
      if (model) this.defaultModel = model
      if (fallbackKey) this.fallbackKey = fallbackKey
      if (fallbackUrl) this.fallbackUrl = fallbackUrl
      if (fallbackModel) this.fallbackModel = fallbackModel

      this.applyEnvFallback()
    } catch {
      this.applyEnvFallback()
    }
  }

  async applyConfig(config: LlmProviderConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    this.defaultModel = config.model || 'gpt-4o-mini'
    this.fallbackKey = config.fallbackApiKey || undefined
    this.fallbackUrl = config.fallbackBaseUrl || undefined
    this.fallbackModel = config.fallbackModel || undefined
    this.simulated = !this.apiKey && !this.fallbackKey

    try {
      const db = databaseService.getClient()
      const upsert = async (key: string, value: string | undefined) => {
        if (value) {
          await (db as any).appConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        }
      }
      await upsert('llm_api_key', config.apiKey)
      await upsert('llm_base_url', config.baseUrl)
      await upsert('llm_model', config.model)
      await upsert('llm_fallback_api_key', config.fallbackApiKey)
      await upsert('llm_fallback_base_url', config.fallbackBaseUrl)
      await upsert('llm_fallback_model', config.fallbackModel)
    } catch {
      // non-critical
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; model?: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'No API key configured' }
    }
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: 'user', content: 'Respond with only the word: ok' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return { success: false, message: `API error (${response.status}): ${body}` }
      }
      const data = await response.json() as any
      return {
        success: true,
        message: `Connected to ${data.model || this.defaultModel}`,
        model: data.model || this.defaultModel,
      }
    } catch (err: any) {
      return { success: false, message: `Connection failed: ${err.message}` }
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (this.simulated) return this.simulateCompletion(request)

    try {
      return await this.callProvider(this.baseUrl, this.apiKey, request)
    } catch (err) {
      if (this.fallbackUrl && this.fallbackKey) {
        try {
          return await this.callProvider(this.fallbackUrl, this.fallbackKey, {
            ...request,
            model: this.fallbackModel || request.model,
          })
        } catch {
          throw err
        }
      }
      throw err
    }
  }

  async classify(text: string, categories: string[], config?: LlmConfig): Promise<string> {
    const system = `You are a classification engine. Classify the input into exactly one of: ${categories.join(', ')}. Respond with only the category name.`
    const response = await this.complete({
      system,
      messages: [{ role: 'user', content: text }],
      model: config?.model,
      temperature: config?.temperature ?? 0.1,
      maxTokens: config?.maxTokens ?? 50,
    })
    const result = response.content.trim()
    return categories.find(c => result.toLowerCase().includes(c.toLowerCase())) || categories[0]
  }

  async summarize(text: string, config?: LlmConfig & { maxLength?: number }): Promise<string> {
    const maxLen = config?.maxLength ?? 200
    const system = `You are a summarization engine. Summarize the following text in at most ${maxLen} characters.`
    const response = await this.complete({
      system,
      messages: [{ role: 'user', content: text }],
      model: config?.model,
      temperature: config?.temperature ?? 0.3,
      maxTokens: config?.maxTokens ?? 300,
    })
    return response.content.trim()
  }

  async reason(context: string, config?: LlmConfig): Promise<string> {
    const system = 'You are a reasoning engine. Think step by step and provide a clear, logical analysis.'
    const response = await this.complete({
      system,
      messages: [{ role: 'user', content: context }],
      model: config?.model,
      temperature: config?.temperature ?? 0.5,
      maxTokens: config?.maxTokens ?? 1000,
    })
    return response.content.trim()
  }

  private async callProvider(
    baseUrl: string,
    apiKey: string,
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      messages: [
        ...(request.system ? [{ role: 'system' as const, content: request.system }] : []),
        ...request.messages.map((m) => {
          const msg: Record<string, unknown> = { role: m.role, content: m.content }
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id
          if (m.tool_calls && m.tool_calls.length > 0) {
            msg.tool_calls = m.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: tc.function.arguments },
            }))
          }
          return msg
        }),
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools
      body.tool_choice = request.toolChoice ?? 'auto'
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`LLM API error: ${response.status} — ${errBody}`)
    }

    const data = await response.json() as any
    const message = data.choices?.[0]?.message
    const rawToolCalls = message?.tool_calls as any[] | undefined

    return {
      content: message?.content || '',
      model: data.model || request.model || this.defaultModel,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
      toolCalls: rawToolCalls
        ? rawToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '{}',
            },
          }))
        : undefined,
    }
  }

  private async simulateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const lastMsg = request.messages[request.messages.length - 1]?.content || ''
    const simulated = `[AI Box: Simulated response for "${lastMsg.slice(0, 50)}..."]`
    return {
      content: simulated,
      model: 'simulated',
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  async trackUsage(params: {
    provider: string
    model: string
    tokensIn: number
    tokensOut: number
    creditsUsed: number
    duration: number
    agentId?: string
    executionId?: string
    toolId?: string
    userId?: string
  }) {
    try {
      const db = databaseService.getClient()
      await db.aiUsage.create({ data: params })
    } catch {
      // non-critical
    }
  }
}

export const llmProvider = new LlmProvider()
