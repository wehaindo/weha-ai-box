'use client'

import { useState } from 'react'
import { runtimeCall, setConfigField } from '@/lib/device-config'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'erp', label: 'ERP' },
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
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [syncResult, setSyncResult] = useState<string>('')

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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">App Settings</h1>
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">General Settings</h2>
            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div>
                <label className="label">Runtime URL</label>
                <input type="text" value={runtimeUrl} onChange={e => setRuntimeUrl(e.target.value)}
                  className="input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ai" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />
                <label htmlFor="ai" className="text-sm">Enable AI Features</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sync" checked={agentSyncEnabled} onChange={e => setAgentSyncEnabled(e.target.checked)} />
                <label htmlFor="sync" className="text-sm">Auto-sync Agents</label>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" className="btn-primary text-sm">Save</button>
                {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
              </div>
            </form>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Sync</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button onClick={handleSyncAgents} disabled={syncingAgents}
                  className="btn-primary text-sm">
                  {syncingAgents ? 'Syncing…' : 'Sync Agents Now'}
                </button>
                <button onClick={handleSyncMcp} disabled={syncingMcp}
                  className="btn-secondary text-sm">
                  {syncingMcp ? 'Syncing…' : 'Sync MCP Tools Now'}
                </button>
              </div>
              {syncResult && (
                <p className="text-sm text-slate-600">{syncResult}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'erp' && (
        <div className="card p-6 space-y-4">
          <SectionLabel>ERP Connection</SectionLabel>
          <button onClick={async () => setErpStatus(await runtimeCall('GET', '/api/erp/status'))}
            className="btn-primary text-sm">
            Check Connection
          </button>
          {erpStatus && <pre className="bg-slate-50 p-3 rounded text-xs font-mono">{JSON.stringify(erpStatus, null, 2)}</pre>}
        </div>
      )}

      {tab === 'mcp' && (
        <div className="card p-6">
          <SectionLabel>MCP Servers</SectionLabel>
          <p className="text-sm text-slate-400">MCP tools are synced from the ERP server. Use the Sync button in the General tab to trigger an immediate sync.</p>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card p-6 space-y-4">
          <SectionLabel>Notification Providers</SectionLabel>
          <button onClick={async () => setNotifStatus(await runtimeCall('GET', '/api/notifications/providers'))}
            className="btn-primary text-sm">
            Check Providers
          </button>
          {notifStatus && <pre className="bg-slate-50 p-3 rounded text-xs font-mono">{JSON.stringify(notifStatus, null, 2)}</pre>}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
      {children}
    </h2>
  )
}
