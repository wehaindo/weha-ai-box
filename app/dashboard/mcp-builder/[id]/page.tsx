'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Wrench, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { runtimeCall } from '@/lib/device-config'

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  DEPRECATED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function McpToolDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [tool, setTool] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [paramsText, setParamsText] = useState('{\n  \n}')

  useEffect(() => {
    runtimeCall('GET', '/api/mcp/tools')
      .then((json: any) => {
        const found = (json?.data || []).find((t: any) => t.id === id)
        setTool(found || null)
      })
      .catch(() => setTool(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleTest = async () => {
    setRunning(true)
    setResult(null)
    try {
      let params = {}
      try { params = JSON.parse(paramsText) } catch { params = {} }
      const json = await runtimeCall('POST', '/api/mcp/tools/execute', { code: tool.code || tool.name, params })
      setResult(JSON.stringify(json, null, 2))
    } catch (err: any) {
      setResult(`Error: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!tool) return <div className="p-8 text-center text-muted-foreground">Tool not found</div>

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold">{tool.name}</h1>
            <p className="text-sm text-muted-foreground">{tool.code}</p>
          </div>
        </div>
        <Badge className={statusColors[tool.status] || ''}>{tool.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span>{tool.code}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{tool.executionType || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>v{tool.version}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Server</span><span>{tool.serverName || 'Local'}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tool.schema && (
            <div>
              <Label>Expected Schema</Label>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32 mt-1">
                {JSON.stringify(tool.schema, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <Label htmlFor="params">Params (JSON)</Label>
            <Textarea
              id="params"
              className="font-mono text-xs min-h-[100px] mt-1"
              value={paramsText}
              onChange={e => setParamsText(e.target.value)}
              placeholder='{ "id": "..." }'
            />
          </div>
          <Button className="w-full" onClick={handleTest} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? 'Testing...' : 'Test Tool'}
          </Button>
        </CardContent>
      </Card>

      {tool.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">{result}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
