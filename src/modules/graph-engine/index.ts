import { nodeRegistry } from './node-handler.js'

// Core nodes
import { startNode } from './nodes/core/start.node.js'
import { endNode } from './nodes/core/end.node.js'
import { conditionNode } from './nodes/core/condition.node.js'
import { switchNode } from './nodes/core/switch.node.js'
import { loopNode } from './nodes/core/loop.node.js'
import { parallelNode } from './nodes/core/parallel.node.js'
import { delayNode } from './nodes/core/delay.node.js'
import { waitNode } from './nodes/core/wait.node.js'

// Utility nodes
import { variableNode } from './nodes/utility/variable.node.js'
import { transformNode } from './nodes/utility/transform.node.js'
import { mathNode } from './nodes/utility/math.node.js'
import { jsonNode } from './nodes/utility/json.node.js'
import { dateNode } from './nodes/utility/date.node.js'

// Business nodes
import { erpQueryNode } from './nodes/business/erp-query.node.js'
import { erpActionNode } from './nodes/business/erp-action.node.js'
import { workflowActionNode } from './nodes/business/workflow-action.node.js'
import { approvalNode } from './nodes/business/approval.node.js'
import { taskNode } from './nodes/business/task.node.js'

// MCP nodes
import { mcpToolNode } from './nodes/mcp/mcp-tool.node.js'
import { mcpWorkflowNode } from './nodes/mcp/mcp-workflow.node.js'

// Communication nodes
import { whotifNode } from './nodes/communication/whotif.node.js'
import { telegramNode } from './nodes/communication/telegram.node.js'
import { emailNode } from './nodes/communication/email.node.js'
import { webhookNode } from './nodes/communication/webhook.node.js'
import { pushNode } from './nodes/communication/push.node.js'

// AI nodes
import { promptNode } from './nodes/ai/prompt.node.js'

export function registerCoreNodes() {
  const nodes = [
    // Core
    startNode, endNode, conditionNode, switchNode, loopNode, parallelNode, delayNode, waitNode,
    // Utility
    variableNode, transformNode, mathNode, jsonNode, dateNode,
    // Business
    erpQueryNode, erpActionNode, workflowActionNode, approvalNode, taskNode,
    // MCP
    mcpToolNode, mcpWorkflowNode,
    // Communication
    whotifNode, telegramNode, emailNode, webhookNode, pushNode,
    // AI
    promptNode,
  ]

  for (const node of nodes) {
    nodeRegistry.register(node)
    console.log(`Registered node: ${node.type}`)
  }

  console.log(`Total nodes registered: ${nodeRegistry.getAll().length}`)
}

export { nodeRegistry } from './node-handler.js'
export { graphExecutor } from './graph-executor.js'
export { parseAgentJson, validateAgentStructure, computeChecksum } from './agent-parser.js'
export { validateDag, topologicalSort } from './dag-validator.js'
