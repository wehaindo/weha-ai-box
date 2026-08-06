import type { NodeHandler } from '../../node-handler.js'
import { databaseService } from '../../../database/database.service.js'
import { graphExecutor } from '../../graph-executor.js'

export const subflowNode: NodeHandler = {
  type: 'subflow',
  category: 'CORE',
  validate(config) {
    const errors: string[] = []
    if (!config.subflow?.agentCode) errors.push('subflow.agentCode is required')
    return errors
  },
  async execute(context) {
    const config = context.node.config
    const db = databaseService.getClient()

    const agent = await db.agent.findFirst({
      where: {
        code: config.subflow?.agentCode,
        isActive: true,
      },
    })

    if (!agent) {
      return {
        success: false,
        error: `Sub-agent not found: ${config.subflow?.agentCode}`,
      }
    }

    const subInput = {
      ...context.variables,
      ...(config.subflow?.params || {}),
    }

    const subExecutionId = `${context.executionId}_sub_${context.nodeId}`
    const result = await graphExecutor.execute(
      agent.definition,
      subExecutionId,
      'MANUAL',
      subInput as Record<string, unknown>,
    )

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    }
  },
}
