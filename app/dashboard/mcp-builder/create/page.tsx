'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { runtimeCall } from '@/lib/device-config'

export default function CreateMcpToolPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    executionType: 'HTTP',
    inputSchema: '{\n  "type": "object",\n  "properties": {}\n}',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      let inputSchema
      try { inputSchema = JSON.parse(form.inputSchema) } catch { inputSchema = { type: 'object', properties: {} } }

      const result = await runtimeCall('POST', '/api/mcp/tools', {
        code: form.code,
        name: form.name,
        description: form.description,
        executionType: form.executionType,
        inputSchema,
        status: 'ACTIVE',
      })

      if ((result as any)?.error) throw new Error((result as any).error)

      router.push('/dashboard/mcp-builder')
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
          <h1 className="text-2xl font-bold">Create MCP Tool</h1>
          <p className="text-sm text-muted-foreground">Define a new MCP tool</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Tool Details</CardTitle>
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
                  placeholder="my-tool"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="My Tool"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what this tool does..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="executionType">Execution Type</Label>
              <Select
                id="executionType"
                value={form.executionType}
                onChange={e => setForm({ ...form, executionType: e.target.value })}
              >
                <option value="HTTP">HTTP</option>
                <option value="SERVICE">Service</option>
                <option value="SCRIPT">Script</option>
                <option value="SQL">SQL</option>
                <option value="WORKFLOW">Workflow</option>
                <option value="WEBHOOK">Webhook</option>
                <option value="COMPOSITE">Composite</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inputSchema">Input Schema (JSON)</Label>
              <Textarea
                id="inputSchema"
                className="font-mono text-xs"
                rows={8}
                value={form.inputSchema}
                onChange={e => setForm({ ...form, inputSchema: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Creating...' : 'Create Tool'}
          </Button>
        </div>
      </form>
    </div>
  )
}
