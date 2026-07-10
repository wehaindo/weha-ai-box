'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { runtimeCall } from '@/lib/device-config'

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  PAUSED: 'bg-purple-100 text-purple-800',
  WAITING_APPROVAL: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-100 text-slate-800',
}

const NODE_STATUS_ICON: Record<string, [string, string]> = {
  COMPLETED: ['✅', 'text-green-600'],
  RUNNING: ['🔄', 'text-blue-600'],
  PAUSED: ['⏸', 'text-purple-600'],
  FAILED: ['❌', 'text-red-600'],
  PENDING: ['⏳', 'text-slate-300'],
  SKIPPED: ['⛔', 'text-slate-400'],
}

function topologicalSort(nodes: any[], edges: any[]): string[] {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    adj.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1)
  }
  const q: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) q.push(id)
  }
  const order: string[] = []
  while (q.length > 0) {
    const id = q.shift()!
    order.push(id)
    for (const next of adj.get(id) || []) {
      const d = (inDeg.get(next) || 1) - 1
      inDeg.set(next, d)
      if (d === 0) q.push(next)
    }
  }
  return order
}

export default function ExecutionDetailPage() {
  const { executionId } = useParams<{ executionId: string }>()
  const router = useRouter()
  const [exec, setExec] = useState<any>(null)
  const [agentDef, setAgentDef] = useState<any>(null)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const execRes = await runtimeCall('GET', `/api/executions/${executionId}`) as any
    const data = execRes?.data
    setExec(data)
    if (data?.agentId) {
      const agentRes = await runtimeCall('GET', `/api/agents/${data.agentId}`) as any
      setAgentDef(agentRes?.data?.definition)
    }
    setLoading(false)
    return data
  }

  useEffect(() => {
    fetchData()
  }, [executionId])

  useEffect(() => {
    if (!exec) return
    if (!['RUNNING', 'PAUSED', 'WAITING_APPROVAL'].includes(exec.status)) return
    const timer = setInterval(fetchData, 3000)
    return () => clearInterval(timer)
  }, [exec?.status])

  const activeExec = exec
  const definition = agentDef
  const nodes: any[] = definition?.nodes || []
  const edges: any[] = definition?.edges || []
  const execOrder = nodes.length > 0 ? topologicalSort(nodes, edges) : []
  const checkpointMap = new Map<string, any>()
  for (const cp of activeExec?.checkpoints || []) {
    checkpointMap.set(cp.nodeId, cp)
  }

  const nodeStatuses: Record<string, string> = {}
  let foundFirstIncomplete = false
  for (const nodeId of execOrder) {
    if (checkpointMap.has(nodeId)) {
      const cp = checkpointMap.get(nodeId)
      const lastResult = cp?.state?.lastResult
      nodeStatuses[nodeId] = lastResult?.success === false ? 'FAILED' : 'COMPLETED'
    } else if (!foundFirstIncomplete) {
      foundFirstIncomplete = true
      const s = activeExec?.status
      nodeStatuses[nodeId] =
        s === 'RUNNING' ? 'RUNNING' :
        s === 'PAUSED' || s === 'WAITING_APPROVAL' ? 'PAUSED' :
        s === 'FAILED' ? 'FAILED' :
        s === 'CANCELLED' ? 'SKIPPED' : 'PENDING'
    } else {
      nodeStatuses[nodeId] = 'PENDING'
    }
  }

  function getNodeLabel(nodeId: string) {
    const n = nodes.find((n) => n.id === nodeId)
    return n?.label || n?.type || nodeId
  }

  function getNodeType(nodeId: string) {
    const n = nodes.find((n) => n.id === nodeId)
    return n?.type || ''
  }

  function getNodeDuration(nodeId: string) {
    const cps = activeExec?.checkpoints || []
    const idx = cps.findIndex((c: any) => c.nodeId === nodeId)
    if (idx === -1) return null
    const start = idx === 0 ? new Date(activeExec.createdAt).getTime() : new Date(cps[idx - 1].createdAt).getTime()
    const end = new Date(cps[idx].createdAt).getTime()
    const ms = end - start
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Loading execution…</div>
  }

  if (!activeExec) {
    return <div className="p-6 text-center text-slate-400">Execution not found.</div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => router.push('/dashboard/executions')} className="text-sm text-blue-600 hover:text-blue-800 mb-4">&larr; Back to Executions</button>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">{activeExec.executionId}</h1>
            <p className="text-sm text-slate-500">
              Agent: <span className="font-medium">{activeExec.agent?.name || activeExec.agentId}</span>
              &nbsp;&middot;&nbsp;Trigger: {activeExec.trigger}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_STYLES[activeExec.status] || 'bg-slate-100 text-slate-500'}`}>
            {activeExec.status}
          </span>
        </div>
        <div className="mt-3 text-xs text-slate-400 flex gap-4">
          <span>Created: {new Date(activeExec.createdAt).toLocaleString()}</span>
          {activeExec.completedAt && <span>Completed: {new Date(activeExec.completedAt).toLocaleString()}</span>}
        </div>
      </div>

      {nodes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Flow Progress ({execOrder.length} steps)</h2>
          <div className="relative">
            {execOrder.map((nodeId, i) => {
              const status = nodeStatuses[nodeId] || 'PENDING'
              const [icon, iconColor] = NODE_STATUS_ICON[status] || ['⏳', 'text-slate-300']
              const cp = checkpointMap.get(nodeId)
              const isExpanded = expandedNode === nodeId
              const isLast = i === execOrder.length - 1

              return (
                <div key={nodeId} className="relative pb-6">
                  {!isLast && <div className="absolute left-[19px] top-8 bottom-0 w-0.5 bg-slate-200" />}
                  <div className="flex items-start gap-3">
                    <div className={`text-lg shrink-0 mt-0.5 ${iconColor}`}>{icon}</div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedNode(isExpanded ? null : nodeId)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-900">{getNodeLabel(nodeId)}</span>
                            <span className="ml-2 text-xs text-slate-400">{getNodeType(nodeId)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {getNodeDuration(nodeId) && <span>{getNodeDuration(nodeId)}</span>}
                            {cp && <span className="text-slate-300">&#9660;</span>}
                          </div>
                        </div>
                      </button>

                      {isExpanded && cp && (
                        <div className="mt-2 ml-1 p-3 bg-slate-50 rounded-lg text-xs space-y-2">
                          {cp.state?.lastResult?.output && Object.keys(cp.state.lastResult.output).length > 0 && (
                            <div>
                              <span className="font-medium text-slate-700">Output:</span>
                              <pre className="mt-1 bg-slate-100 p-2 rounded overflow-x-auto text-slate-600">{JSON.stringify(cp.state.lastResult.output, null, 2)}</pre>
                            </div>
                          )}
                          {cp.variables && Object.keys(cp.variables).length > 0 && (
                            <div>
                              <span className="font-medium text-slate-700">Variables:</span>
                              <pre className="mt-1 bg-slate-100 p-2 rounded overflow-x-auto text-slate-600">{JSON.stringify(cp.variables, null, 2)}</pre>
                            </div>
                          )}
                          {cp.state?.lastResult?.error && (
                            <div>
                              <span className="font-medium text-red-600">Error:</span>
                              <pre className="mt-1 bg-red-50 p-2 rounded overflow-x-auto text-red-500">{cp.state.lastResult.error}</pre>
                            </div>
                          )}
                          {(() => {
                            const nodeLogs = (activeExec.logs || []).filter((l: any) => l.nodeId === nodeId)
                            if (nodeLogs.length === 0) return null
                            return (
                              <div>
                                <span className="font-medium text-slate-700">Logs:</span>
                                <div className="mt-1 space-y-0.5">
                                  {nodeLogs.map((log: any) => (
                                    <div key={log.id} className="flex gap-2 text-xs font-mono">
                                      <span className="text-slate-400 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                      <span className={`shrink-0 font-medium ${
                                        log.level === 'ERROR' ? 'text-red-600' :
                                        log.level === 'WARN' ? 'text-yellow-600' :
                                        'text-blue-600'
                                      }`}>{log.level}</span>
                                      <span className="text-slate-700">{log.message}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {activeExec.input && Object.keys(activeExec.input).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Input</h2>
            <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto text-slate-600">{JSON.stringify(activeExec.input, null, 2)}</pre>
          </div>
        )}
        {activeExec.output && Object.keys(activeExec.output).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Output</h2>
            <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto text-slate-600">{JSON.stringify(activeExec.output, null, 2)}</pre>
          </div>
        )}
      </div>

      {activeExec.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-red-700 mb-2">Error</h2>
          <pre className="text-xs text-red-600 overflow-x-auto">{JSON.stringify(activeExec.error, null, 2)}</pre>
        </div>
      )}

      {(activeExec.logs || []).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Logs ({activeExec.logs.length})</h2>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {activeExec.logs.map((log: any) => (
              <div key={log.id} className="flex gap-2 text-xs font-mono">
                <span className="text-slate-400 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`shrink-0 font-medium ${
                  log.level === 'ERROR' ? 'text-red-600' :
                  log.level === 'WARN' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>{log.level}</span>
                {log.nodeId && <span className="text-slate-400 shrink-0">[{log.nodeId}]</span>}
                <span className="text-slate-700">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
