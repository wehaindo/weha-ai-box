import type { AgentNode, ExecutionContext, NodeResult } from '../../types/index.js'

export interface NodeHandler {
  type: string
  category: string
  validate?(config: Record<string, unknown>): string[]
  execute(context: ExecutionContext): Promise<NodeResult>
  rollback?(context: ExecutionContext): Promise<void>
}

export class NodeRegistry {
  private handlers = new Map<string, NodeHandler>()

  register(handler: NodeHandler) {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler already registered for node type: ${handler.type}`)
    }
    this.handlers.set(handler.type, handler)
  }

  get(type: string): NodeHandler | undefined {
    return this.handlers.get(type)
  }

  has(type: string): boolean {
    return this.handlers.has(type)
  }

  getAll(): NodeHandler[] {
    return Array.from(this.handlers.values())
  }
}

export const nodeRegistry = new NodeRegistry()
