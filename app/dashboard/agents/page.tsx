'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runtimeCall } from '@/lib/device-config'

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    runtimeCall('GET', '/api/agents').then((res: any) => {
      if (res?.data) setAgents(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function runAgent(agentId: string) {
    setRunningId(agentId)
    try {
      const agentRes = await runtimeCall('GET', `/api/agents/${agentId}`) as any
      const definition = agentRes?.data?.definition
      if (!definition) throw new Error('Agent definition not found')
      await runtimeCall('POST', '/api/executions', {
        agentId,
        agentDefinition: definition,
        trigger: 'MANUAL',
        input: {},
      })
      router.push('/dashboard/executions')
    } catch (err: any) {
      alert(err?.message || 'Failed to run agent')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading agents…</div>
        ) : agents.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            No agents synced yet. Go to App Settings and click "Sync Agents Now".
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-500">Name</th>
                <th className="text-left p-3 font-medium text-slate-500">Version</th>
                <th className="text-left p-3 font-medium text-slate-500">Status</th>
                <th className="text-left p-3 font-medium text-slate-500">Deployed</th>
                <th className="text-left p-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a: any) => (
                <tr key={a.agentId} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3 text-slate-500">v{a.version}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-slate-400">
                    {a.deployedAt ? new Date(a.deployedAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => runAgent(a.agentId)}
                      disabled={runningId === a.agentId}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      {runningId === a.agentId ? 'Running…' : 'Run'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
