'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { checkRuntimeHealth, runtimeCall } from '@/lib/device-config';

interface Stat {
  label: string;
  value: string | number;
  color?: string;
}

export default function AppsPage() {
  const [data, setData] = useState<{
    health: any;
    agentCount: number;
    execStats: { total: number; running: number; completed: number; failed: number; pending: number };
    scheduleCount: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [healthRes, execRes, schedRes, readyRes] = await Promise.all([
      checkRuntimeHealth().catch(() => ({ status: 'unreachable' })),
      runtimeCall('GET', '/api/executions').catch(() => ({ data: [] })),
      runtimeCall('GET', '/api/schedules').catch(() => ({ data: [] })),
      runtimeCall('GET', '/api/health/ready').catch(() => ({ agents: 0 })),
    ]);

    const executions = (execRes as any)?.data || [];
    const schedules = (schedRes as any)?.data || [];
    const agentCount = (readyRes as any)?.agents || 0;

    setData({
      health: healthRes,
      agentCount,
      execStats: {
        total: executions.length,
        running: executions.filter((e: any) => e.status === 'RUNNING').length,
        completed: executions.filter((e: any) => e.status === 'COMPLETED').length,
        failed: executions.filter((e: any) => e.status === 'FAILED').length,
        pending: executions.filter((e: any) => ['PENDING', 'WAITING_APPROVAL'].includes(e.status)).length,
      },
      scheduleCount: schedules.length,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats: Stat[] = useMemo(() => {
    if (!data) return [];
    const ok = data.health?.status === 'ok';
    return [
      { label: 'Runtime', value: data.health?.status || '\u2026', color: ok ? 'text-green-600' : 'text-red-600' },
      { label: 'Agents', value: data.agentCount, color: 'text-blue-600' },
      { label: 'Running', value: data.execStats.running, color: 'text-amber-600' },
      { label: 'Schedules', value: data.scheduleCount, color: 'text-purple-600' },
    ];
  }, [data]);

  const cards = [
    { title: 'Agents', desc: 'Deploy and manage AI agents', href: '/dashboard/agents', icon: '\u2699' },
    { title: 'Executions', desc: 'Monitor agent execution history', href: '/dashboard/executions', icon: '\u25B6' },
    { title: 'Scheduler', desc: 'Configure scheduled agent runs', href: '/dashboard/scheduler', icon: '\u23F0' },
    { title: 'App Settings', desc: 'Configure runtime, ERP, MCP and notifications', href: '/dashboard/apps/settings', icon: '\u26A1' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">AI Box Overview</h1>

      {data && (
        <>
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
              <p className="text-2xl font-bold">{data.execStats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{data.execStats.completed}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500 mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-600">{data.execStats.failed}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500 mb-1">Pending / Waiting</p>
              <p className="text-2xl font-bold text-yellow-600">{data.execStats.pending}</p>
            </div>
          </div>
        </>
      )}

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
  );
}
