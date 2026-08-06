'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { runtimeCall } from '@/lib/device-config'

interface AgentDefinition {
  id: string
  agentId: string
  code: string
  name: string
  description: string | null
  type: string | null
  version: number
  status: string
  isActive: boolean
  checksum: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  INACTIVE: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ARCHIVED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function AgentBuilderPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    runtimeCall('GET', '/api/agents')
      .then((json: any) => setAgents(json?.data || []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.code?.toLowerCase().includes(search.toLowerCase()) ||
        a.description?.toLowerCase().includes(search.toLowerCase())
      )
    : agents

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Builder</h1>
          <p className="text-sm text-muted-foreground">Design and manage your AI agents</p>
        </div>
        <Link href="/dashboard/agent-builder/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search agents by name, code, or description..."
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
              {search ? 'No agents match your search' : 'No agents configured yet'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(agent => (
                <Link
                  key={agent.id}
                  href={`/dashboard/agent-builder/${agent.agentId}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.code} {agent.type ? `· ${agent.type}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[agent.status] || ''}>
                      {agent.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{agent.version}</span>
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
