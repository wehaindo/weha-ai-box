import type { AgentNode, AgentEdge } from '../../types/index.js'

export interface ValidationError {
  nodeId?: string
  edgeId?: string
  message: string
}

export function validateDag(nodes: AgentNode[], edges: AgentEdge[]): ValidationError[] {
  const errors: ValidationError[] = []

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const startNodes = nodes.filter((n) => n.type === 'start')
  const endNodes = nodes.filter((n) => n.type === 'end')

  if (startNodes.length === 0) {
    errors.push({ message: 'Agent must have at least one Start node' })
  }
  if (startNodes.length > 1) {
    errors.push({ message: 'Agent must have exactly one Start node' })
  }

  if (endNodes.length === 0) {
    errors.push({ message: 'Agent must have at least one End node' })
  }

  for (const node of nodes) {
    if (!nodeMap.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Node ${node.id} has no definition` })
    }
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      errors.push({ edgeId: edge.id, message: `Edge references unknown source node: ${edge.source}` })
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({ edgeId: edge.id, message: `Edge references unknown target node: ${edge.target}` })
    }
  }

  const outgoingEdges = new Map<string, string[]>()
  const incomingEdges = new Map<string, string[]>()

  for (const edge of edges) {
    if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, [])
    outgoingEdges.get(edge.source)!.push(edge.target)

    if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, [])
    incomingEdges.get(edge.target)!.push(edge.source)
  }

  for (const node of nodes) {
    if (node.type !== 'end' && node.type !== 'wait' && !outgoingEdges.has(node.id) && node.type !== 'switch') {
      errors.push({ nodeId: node.id, message: `Node ${node.id} (${node.type}) has no outgoing edges` })
    }
    if (node.type !== 'start' && node.type !== 'condition' && !incomingEdges.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Node ${node.id} (${node.type}) has no incoming edges` })
    }
  }

  const cycle = detectCycle(nodes, edges)
  if (cycle) {
    errors.push({ message: `Cycle detected in graph: ${cycle.join(' → ')}` })
  }

  return errors
}

export function detectCycle(nodes: AgentNode[], edges: AgentEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) adjacency.set(node.id, [])
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(nodeId: string): string[] | null {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        const result = dfs(neighbor)
        if (result) return [nodeId, ...result]
      } else if (recursionStack.has(neighbor)) {
        return [nodeId, neighbor]
      }
    }

    recursionStack.delete(nodeId)
    return null
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const result = dfs(node.id)
      if (result) return result
    }
  }

  return null
}

export function topologicalSort(nodes: AgentNode[], edges: AgentEdge[]): string[] {
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sorted.push(nodeId)

    for (const neighbor of adjacency.get(nodeId) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
}
