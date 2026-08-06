import type { NodeHandler } from '../../node-handler.js'
import { databaseService } from '../../../database/database.service.js'

export const knowledgeSearchNode: NodeHandler = {
  type: 'knowledge_search',
  category: 'KNOWLEDGE',
  validate(config) {
    const errors: string[] = []
    if (!config.knowledge_search?.query) errors.push('knowledge_search.query is required')
    return errors
  },
  async execute(context) {
    const config = context.node.config
    const query = fillTemplate(config.knowledge_search?.query || '', context.variables)
    const maxResults = config.knowledge_search?.maxResults || 5

    const db = databaseService.getClient()
    const tools = await db.mcpTool.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: maxResults,
    })

    return {
      success: true,
      output: {
        query,
        results: tools.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          serverId: t.serverId,
        })),
        resultCount: tools.length,
      },
    }
  },
}

function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : `{{${key}}}`
  })
}
