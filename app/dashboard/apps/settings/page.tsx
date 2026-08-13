'use client'

import { useState, useEffect } from 'react'
import { runtimeCall, setConfigField, getConfig } from '@/lib/device-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'erp', label: 'ERP' },
  { id: 'ai', label: 'AI Provider' },
  { id: 'mcp', label: 'MCP' },
  { id: 'notifications', label: 'Notifications' },
]

export default function AppSettingsPage() {
  const [tab, setTab] = useState('general')
  const [erpStatus, setErpStatus] = useState<any>(null)
  const [notifStatus, setNotifStatus] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [runtimeUrl, setRuntimeUrl] = useState('http://127.0.0.1:4000')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [agentSyncEnabled, setAgentSyncEnabled] = useState(true)
  const [syncingAgents, setSyncingAgents] = useState(false)
  const [syncingMcp, setSyncingMcp] = useState(false)
  const [syncResult, setSyncResult] = useState<string>('')
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [loadingMcp, setLoadingMcp] = useState(false)

  useEffect(() => {
    getConfig().then((cfg) => {
      if (cfg.runtimeUrl) setRuntimeUrl(cfg.runtimeUrl)
      setAiEnabled(cfg.aiEnabled)
      setAgentSyncEnabled(cfg.agentSyncEnabled)
    }).catch(() => {})
  }, [])

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    await setConfigField('runtimeUrl', runtimeUrl)
    await setConfigField('aiEnabled', aiEnabled)
    await setConfigField('agentSyncEnabled', agentSyncEnabled)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleSyncAgents() {
    setSyncingAgents(true)
    setSyncResult('')
    try {
      const res = await runtimeCall('POST', '/api/sync/agents') as any
      setSyncResult(`Agents: ${res?.status || 'done'}`)
    } catch (err: any) {
      setSyncResult(`Error: ${err.message}`)
    } finally {
      setSyncingAgents(false)
    }
  }

  async function handleSyncMcp() {
    setSyncingMcp(true)
    setSyncResult('')
    try {
      const res = await runtimeCall('POST', '/api/sync/mcp') as any
      setSyncResult(`MCP: ${res?.status || 'done'}`)
    } catch (err: any) {
      setSyncResult(`Error: ${err.message}`)
    } finally {
      setSyncingMcp(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">App Settings</h1>
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="runtimeUrl">Runtime URL</Label>
                  <Input id="runtimeUrl" value={runtimeUrl} onChange={e => setRuntimeUrl(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ai" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                  <Label htmlFor="ai" className="mb-0">Enable AI Features</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="sync" checked={agentSyncEnabled} onChange={e => setAgentSyncEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" />
                  <Label htmlFor="sync" className="mb-0">Auto-sync Agents</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit">
                    {saved ? '✓ Saved' : 'Save'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button onClick={handleSyncAgents} disabled={syncingAgents}>
                    {syncingAgents ? 'Syncing…' : 'Sync Agents Now'}
                  </Button>
                  <Button variant="secondary" onClick={handleSyncMcp} disabled={syncingMcp}>
                    {syncingMcp ? 'Syncing…' : 'Sync MCP Tools Now'}
                  </Button>
                </div>
                {syncResult && (
                  <p className="text-sm text-muted-foreground">{syncResult}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'erp' && (
        <Card>
          <CardHeader>
            <CardTitle>ERP Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={async () => setErpStatus(await runtimeCall('GET', '/api/erp/status'))}>
              Check Connection
            </Button>
            {erpStatus && (
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-64">
                {JSON.stringify(erpStatus, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'ai' && (
        <AiProviderSettings />
      )}

      {tab === 'mcp' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>MCP Servers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                MCP tools are synced from the ERP server. Use the Sync button in the General tab to trigger an immediate sync.
              </p>
              <Button variant="outline" onClick={async () => {
                setLoadingMcp(true)
                try {
                  const res = await runtimeCall('GET', '/api/mcp/servers') as any
                  setMcpServers(res?.data || [])
                } catch { setMcpServers([]) }
                setLoadingMcp(false)
              }} className="mb-4">
                {loadingMcp ? 'Loading...' : 'Refresh MCP Servers'}
              </Button>
              {mcpServers.length > 0 && (
                <div className="space-y-2">
                  {mcpServers.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.url}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.status === 'CONNECTED' ? 'default' : 'destructive'}>
                          {s.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s._count?.tools || 0} tools</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Providers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={async () => setNotifStatus(await runtimeCall('GET', '/api/notifications/providers'))}>
              Check Providers
            </Button>
            {notifStatus && (
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-64">
                {JSON.stringify(notifStatus, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AiProviderSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const [form, setForm] = useState({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    fallbackApiKey: '',
    fallbackBaseUrl: '',
    fallbackModel: '',
  })
  const [status, setStatus] = useState<{ configured: boolean; simulated: boolean; provider: string; model: string } | null>(null)

  useEffect(() => {
    runtimeCall('GET', '/api/settings/llm').then((r: any) => {
      const d = r?.data
      if (d) {
        setForm({
          apiKey: d.apiKey || '',
          baseUrl: d.baseUrl || 'https://api.openai.com/v1',
          model: d.model || 'gpt-4o-mini',
          fallbackApiKey: d.fallbackApiKey || '',
          fallbackBaseUrl: d.fallbackBaseUrl || '',
          fallbackModel: d.fallbackModel || '',
        })
        setStatus({
          configured: d.configured,
          simulated: d.simulated,
          provider: d.provider,
          model: d.model,
        })
        if (d.fallbackApiKey || d.fallbackBaseUrl || d.fallbackModel) setShowFallback(true)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await runtimeCall('POST', '/api/settings/llm', {
        apiKey: form.apiKey.startsWith('••••') ? '' : form.apiKey,
        baseUrl: form.baseUrl,
        model: form.model,
        fallbackApiKey: form.fallbackApiKey.startsWith('••••') ? '' : form.fallbackApiKey,
        fallbackBaseUrl: form.fallbackBaseUrl,
        fallbackModel: form.fallbackModel,
      })
      setSaved(true)
      setStatus({ configured: true, simulated: false, provider: form.baseUrl.includes('openai') ? 'openai' : 'custom', model: form.model })
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await runtimeCall('POST', '/api/settings/llm/test') as any
      setTestResult(res?.success ? `✅ ${res.message}` : `❌ ${res.message}`)
    } catch (err: any) {
      setTestResult(`❌ ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent></Card>

  return (
    <div className="space-y-6">
      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={status.configured ? 'default' : 'secondary'}>
                {status.configured ? 'Configured' : 'Not Configured'}
              </Badge>
              {status.simulated && (
                <span className="text-xs text-yellow-600">(running in simulated mode — no API key)</span>
              )}
              <span className="text-xs text-muted-foreground">{status.provider} · {status.model}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Primary Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="apiKey">API Key</Label>
            <Input id="apiKey" type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input id="baseUrl" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="gpt-4o-mini" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button type="button" onClick={() => setShowFallback(!showFallback)} className="flex items-center gap-2 text-left w-full">
            <CardTitle>Fallback Provider {showFallback ? '▲' : '▼'}</CardTitle>
          </button>
        </CardHeader>
        {showFallback && (
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="fallbackApiKey">Fallback API Key</Label>
              <Input id="fallbackApiKey" type="password" value={form.fallbackApiKey} onChange={e => setForm({ ...form, fallbackApiKey: e.target.value })}
                placeholder="sk-..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="fallbackBaseUrl">Fallback Base URL</Label>
                <Input id="fallbackBaseUrl" value={form.fallbackBaseUrl} onChange={e => setForm({ ...form, fallbackBaseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fallbackModel">Fallback Model</Label>
                <Input id="fallbackModel" value={form.fallbackModel} onChange={e => setForm({ ...form, fallbackModel: e.target.value })}
                  placeholder="gpt-4o-mini" />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {testResult && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">{testResult}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
