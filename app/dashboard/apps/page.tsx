'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { checkRuntimeHealth, runtimeCall } from '@/lib/device-config'

interface Stat {
  label: string
  value: string | number
  color?: string
  href?: string
}

export default function AppsPage() {
  const [health, setHealth] = useState<any>(null)
  const [agentCount, setAgentCount] = useState(0)
  const [execStats, setExecStats] = useState({ total: 0, running: 0, completed: 0, failed: 0, pending: 0 })
  const [scheduleCount, setScheduleCount] = useState(0)

  useEffect(() => {
    checkRuntimeHealth().then(setHealth).catch(() => setHealth({ status: 'unreachable' }))
    runtimeCall('GET', '/api/executions').then((res: any) => {
      if (res?.data) {
        const d = res.data
        setExecStats({
          total: d.length,
          running: d.filter((e: any) => e.status === 'RUNNING').length,
          completed: d.filter((e: any) => e.status === 'COMPLETED').length,
          failed: d.filter((e: any) => e.status === 'FAILED').length,
          pending: d.filter((e: any) => ['PENDING', 'WAITING_APPROVAL'].includes(e.status)).length,
        })
      }
    }).catch(() => {})
    runtimeCall('GET', '/api/schedules').then((res: any) => {
      if (res?.data) setScheduleCount(res.data.length)
    }).catch(() => {})
    runtimeCall('GET', '/api/health/ready').then((res: any) => {
      if (res?.agents) setAgentCount(res.agents)
    }).catch(() => {})
  }, [])

  const ok = health?.status === 'ok'

  const stats: Stat[] = [
    { label: 'Runtime', value: health?.status || '…', color: ok ? 'text-green-600' : 'text-red-600' },
    { label: 'Agents', value: agentCount, color: 'text-blue-600' },
    { label: 'Running', value: execStats.running, color: 'text-amber-600' },
    { label: 'Schedules', value: scheduleCount, color: 'text-purple-600' },
  ]

  const cards = [
    { title: 'Agents', desc: 'Deploy and manage AI agents', href: '/dashboard/agents', icon: '⚙' },
    { title: 'Executions', desc: 'Monitor agent execution history', href: '/dashboard/executions', icon: '▶' },
    { title: 'Scheduler', desc: 'Configure scheduled agent runs', href: '/dashboard/scheduler', icon: '⏰' },
    { title: 'App Settings', desc: 'Configure runtime, ERP, MCP and notifications', href: '/dashboard/apps/settings', icon: '⚡' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">AI Box Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color || 'text-slate-900'}`}>{String(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Total Executions</p>
          <p className="text-2xl font-bold">{execStats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{execStats.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-600">{execStats.failed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500 mb-1">Pending / Waiting</p>
          <p className="text-2xl font-bold text-yellow-600">{execStats.pending}</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Quick Links</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
            <span className="text-2xl mb-2 block">{c.icon}</span>
            <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{c.title}</p>
            <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
