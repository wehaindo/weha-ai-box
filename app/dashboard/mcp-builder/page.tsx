'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { runtimeCall } from '@/lib/device-config'

interface McpTool {
  id: string
  code: string
  name: string
  description: string | null
  executionType: string | null
  status: string
  version: number
  serverId: string | null
  serverName: string | null
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  DEPRECATED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function McpBuilderPage() {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    runtimeCall('GET', '/api/mcp/tools')
      .then((json: any) => setTools(json?.data || []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? tools.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tools

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Builder</h1>
          <p className="text-sm text-muted-foreground">Manage your MCP tool definitions</p>
        </div>
        <Link href="/dashboard/mcp-builder/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Tool
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tools</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tools by name, code, or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No tools match your search' : 'No MCP tools configured yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(tool => (
                <Link
                  key={tool.id}
                  href={`/dashboard/mcp-builder/${tool.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Wrench className="h-5 w-5 text-cyan-500" />
                    <div>
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tool.code} {tool.executionType ? `· ${tool.executionType}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[tool.status] || ''}>
                      {tool.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{tool.version}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
