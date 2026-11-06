import { databaseService } from '../database/database.service.js'
import type { ChatRole } from '@prisma/client'

export interface NewMessageInput {
  role: ChatRole
  content: string
  toolCalls?: unknown
  toolResults?: unknown
  tokenUsage?: number
  model?: string
}

export interface MessageRecord {
  id: string
  role: ChatRole
  content: string
  toolCalls: unknown
  toolResults: unknown
  tokenUsage: number
  model: string | null
  createdAt: Date
}

export class ConversationService {
  async createConversation(title?: string, userId?: string): Promise<{ id: string; title: string; createdAt: Date; updatedAt: Date }> {
    const db = databaseService.getClient()
    return await db.conversation.create({
      data: {
        title: title || 'New Chat',
        ...(userId ? { userId } : {}),
      },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
  }

  /** Find a conversation by its external key (e.g. a WHOTIF conversation id). */
  async getConversationByUserId(userId: string): Promise<{ id: string } | null> {
    const db = databaseService.getClient()
    return await db.conversation.findFirst({
      where: { userId },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async listConversations(): Promise<{ id: string; title: string; createdAt: Date; updatedAt: Date; messageCount: number }[]> {
    const db = databaseService.getClient()
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    })
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    }))
  }

  async getConversation(id: string): Promise<{ id: string; title: string; createdAt: Date; updatedAt: Date; messages: MessageRecord[] } | null> {
    const db = databaseService.getClient()
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) return null
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolResults: m.toolResults,
        tokenUsage: m.tokenUsage,
        model: m.model,
        createdAt: m.createdAt,
      })),
    }
  }

  async deleteConversation(id: string): Promise<boolean> {
    const db = databaseService.getClient()
    try {
      await db.chatMessage.deleteMany({ where: { conversationId: id } })
      await db.conversation.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async updateTitle(id: string, title: string): Promise<void> {
    const db = databaseService.getClient()
    try {
      await db.conversation.update({
        where: { id },
        data: { title },
      })
    } catch {
      // non-critical
    }
  }

  async addMessage(conversationId: string, input: NewMessageInput): Promise<MessageRecord> {
    const db = databaseService.getClient()
    const message = await db.chatMessage.create({
      data: {
        conversationId,
        role: input.role,
        content: input.content,
        toolCalls: (input.toolCalls as any) || undefined,
        toolResults: (input.toolResults as any) || undefined,
        tokenUsage: input.tokenUsage || 0,
        model: input.model,
      },
    })
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      toolResults: message.toolResults,
      tokenUsage: message.tokenUsage,
      model: message.model,
      createdAt: message.createdAt,
    }
  }
}

export const conversationService = new ConversationService()
