'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { runtimeCall } from '@/lib/device-config'

export default function CreateAgentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    type: 'custom',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const agentGraph = {
        agent: {
          id: form.code,
          code: form.code,
          name: form.name,
          type: form.type,
          version: 1,
        },
        metadata: {
          tags: [],
          category: '',
          owner: '',
          description: form.description,
        },
        variables: [],
        nodes: [
          {
            id: 'start',
            type: 'start',
            category: 'CORE',
            label: 'Start',
            config: {},
            position: { x: 250, y: 0 },
          },
          {
            id: 'end',
            type: 'end',
            category: 'CORE',
            label: 'End',
            config: {},
            position: { x: 250, y: 200 },
          },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'end' },
        ],
        permissions: { roles: ['ADMIN'] },
        settings: { errorHandling: 'stop', logging: 'INFO' },
        outputs: [],
        version: 1,
        checksum: '',
      }

      const result = await runtimeCall('POST', '/api/sync/command/deploy', {
        agentId: form.code,
        definition: agentGraph,
      })

      if ((result as any)?.error) throw new Error((result as any).error)

      router.push('/dashboard/agent-builder')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Agent</h1>
          <p className="text-sm text-muted-foreground">Define a new AI agent</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  required
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="my-agent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="My Agent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what this agent does..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                placeholder="custom"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Creating...' : 'Create Agent'}
          </Button>
        </div>
      </form>
    </div>
  )
}
