import { llmProvider } from '../llm/llm-provider.service.js'
import { conversationService, type MessageRecord } from './conversation.service.js'
import { getChatTools, toFunctionTools, findChatTool, summarizeAgentsForPrompt, summarizeToolsForPrompt, listAgentsCatalog } from './tools.js'
import { executeChatTool } from './tool-executor.js'
import type { ToolCall } from '../llm/llm-provider.service.js'

const MAX_ITERATIONS = 6

interface LlmMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ToolActivityEntry {
  name: string
  status: 'ok' | 'error'
  summary: string
  durationMs: number
}

export interface ChatTurnResult {
  conversationId: string
  assistantMessage: MessageRecord
  toolActivity: ToolActivityEntry[]
  model: string
  usage: { promptTokens: number; completionTokens: number }
}

function buildSystemPrompt(agentCatalog: string, toolCatalog: string): string {
  return [
    'You are the WEHA AI Box assistant, an AI agent operating on a customer-premises agent execution platform.',
    'You can answer questions about the system and take actions on the user\'s behalf by calling tools.',
    '',
    '## Available agents (business workflows)',
    agentCatalog,
    '',
    '## Available tools (MCP / local)',
    toolCatalog,
    '',
    '## Guidance',
    '- Use list_agents to get the current agent catalog when the user asks to run an agent or when you need an agentId.',
    '- Use run_agent to execute an agent; pass input variables the agent expects as an object.',
    '- Use MCP tools to query or act on external systems (ERP, services, etc.) when the task requires it.',
    '- Match the user request to the tool whose name/description best fits (e.g. "check inventory" should use the inventory tool). If unsure, use list_agents or ask the user to clarify.',
    '- MCP tools and agents are managed in WEHA ERP; you only execute them. If the user asks to create or modify a tool or agent, explain that these are provisioned from WEHA ERP.',
    '- Prefer concrete tool results over guessing. If a tool errors, report the error clearly and suggest a next step.',
    '- Respond concisely and in the same language as the user.',
    '- After running tools, summarize what was done and the key results for the user.',
  ].join('\n')
}

function buildMessageHistory(records: MessageRecord[]): LlmMessage[] {
  const messages: LlmMessage[] = []
  for (const record of records) {
    if (record.role === 'SYSTEM') continue

    if (record.role === 'USER') {
      messages.push({ role: 'user', content: record.content })
      continue
    }

    if (record.role === 'TOOL') {
      messages.push({ role: 'tool', content: record.content })
      continue
    }

    const toolCalls = (record.toolCalls as ToolCall[] | null) || []
    if (toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: record.content || '',
        tool_calls: toolCalls,
      })
      const results = (record.toolResults as { id: string; result: string }[] | null) || []
      for (const r of results) {
        messages.push({ role: 'tool', content: r.result, tool_call_id: r.id })
      }
    } else {
      messages.push({ role: 'assistant', content: record.content })
    }
  }
  return messages
}

async function trackUsage(
  executionId: string | null,
  model: string,
  usage: { promptTokens: number; completionTokens: number },
  duration: number,
) {
  await llmProvider.trackUsage({
    provider: model.includes('gpt') ? 'openai' : 'local',
    model,
    tokensIn: usage.promptTokens,
    tokensOut: usage.completionTokens,
    creditsUsed: 0,
    duration,
    executionId: executionId || undefined,
  })
}

export class ChatService {
  async sendMessage(conversationId: string, userContent: string): Promise<ChatTurnResult> {
    const conversation = await conversationService.getConversation(conversationId)
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    await conversationService.addMessage(conversationId, { role: 'USER', content: userContent })
    if (conversation.title === 'New Chat') {
      const title = userContent.trim().slice(0, 60)
      if (title) await conversationService.updateTitle(conversationId, title)
    }

    const agents = await listAgentsCatalog()
    const tools = await getChatTools()
    const systemPrompt = buildSystemPrompt(summarizeAgentsForPrompt(agents), summarizeToolsForPrompt(tools))

    const refreshed = await conversationService.getConversation(conversationId)
    let history = buildMessageHistory(refreshed?.messages || [])
    const functionTools = toFunctionTools(tools)

    const toolActivity: ToolActivityEntry[] = []
    let totalPrompt = 0
    let totalCompletion = 0
    let model = ''

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const startedAt = Date.now()
      const response = await llmProvider.complete({
        system: systemPrompt,
        messages: history,
        tools: functionTools,
      })

      model = response.model
      totalPrompt += response.usage.promptTokens
      totalCompletion += response.usage.completionTokens

      if (!response.toolCalls || response.toolCalls.length === 0) {
        const assistant = await conversationService.addMessage(conversationId, {
          role: 'ASSISTANT',
          content: response.content,
          tokenUsage: response.usage.completionTokens,
          model: response.model,
        })
        await trackUsage(null, model, { promptTokens: totalPrompt, completionTokens: totalCompletion }, Date.now() - startedAt)
        return { conversationId, assistantMessage: assistant, toolActivity, model, usage: { promptTokens: totalPrompt, completionTokens: totalCompletion } }
      }

      const toolCallResults: { id: string; result: string }[] = []
      for (const toolCall of response.toolCalls) {
        const startedToolAt = Date.now()
        const tool = findChatTool(tools, toolCall.function.name)
        if (!tool) {
          const errMsg = `Unknown function: ${toolCall.function.name}`
          toolCallResults.push({ id: toolCall.id, result: `ERROR: ${errMsg}` })
          toolActivity.push({ name: toolCall.function.name, status: 'error', summary: errMsg, durationMs: Date.now() - startedToolAt })
          continue
        }

        let parsedArgs: Record<string, unknown> = {}
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments || '{}')
        } catch {
          parsedArgs = {}
        }

        const resultText = await executeChatTool(tool, parsedArgs)
        const isError = resultText.startsWith('ERROR:')
        toolCallResults.push({ id: toolCall.id, result: resultText })
        toolActivity.push({
          name: toolCall.function.name,
          status: isError ? 'error' : 'ok',
          summary: isError ? resultText : `${tool.name} completed`,
          durationMs: Date.now() - startedToolAt,
        })
      }

      await conversationService.addMessage(conversationId, {
        role: 'ASSISTANT',
        content: '',
        toolCalls: response.toolCalls,
        toolResults: toolCallResults,
        tokenUsage: response.usage.completionTokens,
        model: response.model,
      })

      history = buildMessageHistory(
        (await conversationService.getConversation(conversationId))!.messages,
      )
    }

    const fallback = await conversationService.addMessage(conversationId, {
      role: 'ASSISTANT',
      content: 'I reached the maximum number of tool-call steps for this request. Please try a more specific question, or check the Executions page if you started an agent.',
      model,
    })
    return { conversationId, assistantMessage: fallback, toolActivity, model, usage: { promptTokens: totalPrompt, completionTokens: totalCompletion } }
  }
}

export const chatService = new ChatService()
