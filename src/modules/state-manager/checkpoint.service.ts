import { databaseService } from '../database/database.service.js'

interface CheckpointData {
  executionId: string
  nodeId: string
  nodeType: string
  state: Record<string, unknown>
  variables: Record<string, unknown>
}

class CheckpointService {
  async save(data: CheckpointData) {
    try {
      const db = databaseService.getClient()
      await db.checkpoint.create({
        data: {
          executionId: data.executionId,
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          state: data.state,
          variables: data.variables,
        },
      })
    } catch (error) {
      console.error('Failed to save checkpoint:', error)
    }
  }

  async getLatest(executionId: string) {
    try {
      const db = databaseService.getClient()
      return await db.checkpoint.findFirst({
        where: { executionId },
        orderBy: { createdAt: 'desc' },
      })
    } catch {
      return null
    }
  }

  async list(executionId: string) {
    try {
      const db = databaseService.getClient()
      return await db.checkpoint.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      })
    } catch {
      return []
    }
  }

  async recoverExecution(executionId: string): Promise<{ recovered: boolean; checkpoint?: any }> {
    const checkpoint = await this.getLatest(executionId)
    if (!checkpoint) return { recovered: false }

    try {
      const db = databaseService.getClient()
      await db.execution.update({
        where: { executionId },
        data: { status: 'RUNNING' },
      })
      return { recovered: true, checkpoint }
    } catch {
      return { recovered: false }
    }
  }
}

export const checkpointService = new CheckpointService()
