'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bot, Play, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { runtimeCall } from '@/lib/device-config'

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ARCHIVED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function AgentDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    runtimeCall('GET', `/api/agents/${encodeURIComponent(id)}`)
      .then((json: any) => setAgent(json?.data || null))
      .catch(() => setAgent(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleRun = async () => {
    setRunning(true)
    try {
      const json = await runtimeCall('POST', '/api/executions', { agentId: id, trigger: 'MANUAL', input: {} })
      if ((json as any)?.data?.executionId) {
        router.push(`/dashboard/executions/${(json as any).data.executionId}`)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!agent) return <div className="p-8 text-center text-muted-foreground">Agent not found</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.code || agent.agentId}</p>
          </div>
        </div>
        <Badge className={statusColors[agent.status] || ''}>{agent.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span>{agent.agentId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{agent.type || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>v{agent.version}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nodes</span><span>{agent.nodes?.length || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Edges</span><span>{agent.edges?.length || 0}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={handleRun} disabled={running}>
              <Play className="mr-2 h-4 w-4" />
              {running ? 'Running...' : 'Run Agent'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {agent.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </CardContent>
        </Card>
      )}

      {agent.nodes && agent.nodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {agent.nodes.map((node: any) => (
                <div key={node.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{node.label}</span>
                  <span className="text-xs text-muted-foreground">({node.type})</span>
                  {node.category && (
                    <Badge variant="secondary" className="text-xs">{node.category}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {agent.settings && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(agent.settings, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
