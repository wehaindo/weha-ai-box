'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { runtimeCall } from '@/lib/device-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TOKEN_COST = { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 }

interface ExecutionLogEntry {
  nodeId: string
  nodeType: string
  label: string
  duration: number
  status: 'success' | 'failed' | 'skipped' | 'pending_approval' | 'waiting_input'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  tokenUsage?: number
}

function NodeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    start: '▶', end: '■', condition: '◇', switch: '⬡', loop: '↻',
    parallel: '∥', delay: '⏱', wait: '⏸', prompt: '💬', reasoning: '🧠',
    summary: '📋', classification: '🏷', 'mcp-tool': '🔧', 'mcp-workflow': '⚙',
    'erp-query': '🔍', 'erp-action': '⚡', 'workflow-action': '🔄',
    webhook: '🔗', telegram: '✉', email: '📧', notification: '🔔', push: '📲',
    whotif: '💭', approval: '✅', human_input: '👤', knowledge_search: '📚',
    subflow: '🔀', task: '📝', database: '🗄', script: '📜',
    variable: '📌', transform: '🔄', math: '🔢', json: '📦', date: '📅',
  }
  return <span className="text-base">{icons[type] || '⚪'}</span>
}

function statusBadge(status: string): { label: string; variant: string; dot: string } {
  const map: Record<string, { label: string; variant: string; dot: string }> = {
    success: { label: 'Success', variant: 'default', dot: 'bg-green-500' },
    failed: { label: 'Failed', variant: 'destructive', dot: 'bg-red-500' },
    skipped: { label: 'Skipped', variant: 'secondary', dot: 'bg-gray-400' },
    pending_approval: { label: 'Pending Approval', variant: 'secondary', dot: 'bg-yellow-500' },
    waiting_input: { label: 'Waiting Input', variant: 'secondary', dot: 'bg-purple-500' },
    running: { label: 'Running', variant: 'secondary', dot: 'bg-blue-500' },
    pending: { label: 'Pending', variant: 'outline', dot: 'bg-gray-300' },
  }
  return map[status] || { label: status, variant: 'outline', dot: 'bg-gray-300' }
}

function renderOutput(entry: ExecutionLogEntry) {
  const out = (entry.output || {}) as any
  const nodeType = entry.nodeType
  const aiTypes = ['prompt', 'reasoning', 'summary', 'classification']

  if (aiTypes.includes(nodeType)) {
    return (
      <div className="mt-1 space-y-2">
        {out.prompt && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-medium text-muted-foreground mb-1">Prompt</span>
            <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground max-w-full whitespace-pre-wrap break-words">
              {String(out.prompt)}
            </div>
          </div>
        )}
        {out.response && (
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium text-muted-foreground mb-1">Response</span>
            <div className="bg-primary/10 rounded-xl rounded-tr-sm px-3 py-2 text-sm text-foreground max-w-full whitespace-pre-wrap break-words">
              {String(out.response)}
            </div>
          </div>
        )}
        {out.reasoning && (
          <div className="bg-muted rounded-xl px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
            {String(out.reasoning)}
          </div>
        )}
        {out.summary && (
          <div className="bg-muted rounded-xl px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
            {String(out.summary)}
          </div>
        )}
        {out.classification && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Category:</span>
            <Badge variant="secondary" className="text-xs">{String(out.classification)}</Badge>
          </div>
        )}
        {/* Fallback: show remaining keys not already displayed */}
        {Object.keys(out).filter(k => !['prompt','response','reasoning','summary','classification','categories'].includes(k)).length > 0 && (
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 text-foreground">
            {JSON.stringify(Object.fromEntries(
              Object.entries(out).filter(([k]) => !['prompt','response','reasoning','summary','classification','categories'].includes(k))
            ), null, 2)}
          </pre>
        )}
      </div>
    )
  }

  // Default: render as raw JSON
  return (
    <pre className="mt-1 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64 text-foreground">
      {JSON.stringify(entry.output, null, 2)}
    </pre>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function estimateCost(tokenUsage: number, isOutput = true): number {
  return tokenUsage * (isOutput ? TOKEN_COST.output : TOKEN_COST.input)
}

export default function ExecutionDetailPage() {
  const { executionId } = useParams<{ executionId: string }>();
  const router = useRouter();
  const [exec, setExec] = useState<any>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const execRes = await runtimeCall('GET', `/api/executions/${executionId}`) as any;
    setExec(execRes?.data);
    setLoading(false);
    return execRes?.data;
  }, [executionId]);

  useEffect(() => { fetchData() }, [fetchData]);

  useEffect(() => {
    if (!exec) return;
    if (!['RUNNING', 'PAUSED', 'WAITING_APPROVAL'].includes(exec.status)) return;
    const timer = setInterval(fetchData, 3000);
    return () => clearInterval(timer);
  }, [exec?.status, fetchData]);

  const execLog: ExecutionLogEntry[] = useMemo(() => {
    return exec?.output?.executionLog || []
  }, [exec?.output]);

  const totalDuration = useMemo(() =>
    execLog.reduce((sum, e) => sum + e.duration, 0), [execLog])

  const totalTokens = useMemo(() =>
    execLog.reduce((sum, e) => sum + (e.tokenUsage || 0), 0), [execLog])

  const totalCost = useMemo(() => {
    const outputTokens = execLog.reduce((s, e) => s + (e.tokenUsage || 0), 0)
    return estimateCost(outputTokens, true)
  }, [execLog])

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading execution…</div>;
  }

  if (!exec) {
    return <div className="p-6 text-center text-muted-foreground">Execution not found.</div>;
  }

  return (
    <div className="w-full max-w-full mx-auto space-y-6">
      <button onClick={() => router.push('/dashboard/executions')} className="text-sm text-primary hover:text-primary/80">&larr; Back to Executions</button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{exec.executionId}</h1>
                <Badge variant={exec.status === 'COMPLETED' ? 'default' : exec.status === 'FAILED' ? 'destructive' : 'secondary'}>
                  {exec.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Agent: <span className="font-medium">{exec.agent?.name || exec.agentId}</span>
                &nbsp;&middot;&nbsp;Trigger: {exec.trigger}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>Created: {new Date(exec.createdAt).toLocaleString()}</span>
            {exec.completedAt && <span>Completed: {new Date(exec.completedAt).toLocaleString()}</span>}
            <span>Duration: {formatDuration(totalDuration)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      {execLog.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{execLog.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Steps</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{formatDuration(totalDuration)}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Time</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{totalTokens.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">Tokens Used</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">${totalCost.toFixed(6)}</div>
              <div className="text-xs text-muted-foreground mt-1">Est. Cost</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Execution steps */}
      {execLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Execution Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {execLog.map((entry, i) => {
                const isExpanded = expandedNode === entry.nodeId;
                const sb = statusBadge(entry.status);
                const isLast = i === execLog.length - 1;

                return (
                  <div key={entry.nodeId + i} className="relative">
                    {/* Timeline connector */}
                    {!isLast && (
                      <div className="absolute left-[18px] top-10 bottom-0 w-0.5 bg-border" />
                    )}
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        entry.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                        entry.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                        'bg-muted'
                      }`}>
                        <NodeIcon type={entry.nodeType} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <button
                          onClick={() => setExpandedNode(isExpanded ? null : entry.nodeId)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{entry.label}</span>
                              <span className="text-xs text-muted-foreground font-mono">{entry.nodeType}</span>
                              <Badge variant={sb.variant as any} className="text-[10px] px-1.5 py-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${sb.dot} mr-1 inline-block`} />
                                {sb.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {entry.tokenUsage ? (
                                <span className="font-mono text-yellow-600 dark:text-yellow-400">{entry.tokenUsage} tok</span>
                              ) : null}
                              <span className="font-mono">{formatDuration(entry.duration)}</span>
                              {entry.output && Object.keys(entry.output).length > 0 && (
                                <span className="text-muted-foreground/50">▼</span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 space-y-3 pl-1">
                            {entry.input && Object.keys(entry.input).length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Input</span>
                                <pre className="mt-1 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 text-foreground">
                                  {JSON.stringify(entry.input, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.output && Object.keys(entry.output).length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Output</span>
                                {renderOutput(entry)}
                              </div>
                            )}
                            {entry.error && (
                              <div>
                                <span className="text-xs font-medium text-destructive">Error</span>
                                <pre className="mt-1 text-xs bg-destructive/10 p-3 rounded-lg overflow-auto text-destructive">
                                  {entry.error}
                                </pre>
                              </div>
                            )}
                            {entry.tokenUsage ? (
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Tokens: <span className="font-mono text-foreground">{entry.tokenUsage}</span></span>
                                <span>Cost: <span className="font-mono text-foreground">${estimateCost(entry.tokenUsage, true).toFixed(7)}</span></span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Output JSON (raw) */}
      {exec.output && Object.keys(exec.output).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">{JSON.stringify(exec.output, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {exec.error && (
        <Card className="border-destructive/20 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-destructive overflow-auto max-h-48">{JSON.stringify(exec.error, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {(exec.logs || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Logs ({exec.logs.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <div className="space-y-1">
              {exec.logs.map((log: any) => (
                <div key={log.id} className="flex gap-2 text-xs font-mono">
                  <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`shrink-0 font-medium ${
                    log.level === 'ERROR' ? 'text-destructive' :
                    log.level === 'WARN' ? 'text-yellow-600' : 'text-blue-600'
                  }`}>{log.level}</span>
                  {log.nodeId && <span className="text-muted-foreground shrink-0">[{log.nodeId}]</span>}
                  <span className="text-foreground">{log.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
