'use client'

import { useEffect, useState } from 'react'
import { runtimeCall } from '@/lib/device-config'

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runtimeCall('GET', '/api/schedules').then((res: any) => {
      if (res?.data) setSchedules(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scheduler</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Create Schedule</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="p-6 text-center text-slate-400">No schedules configured.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-500">Name</th>
                <th className="text-left p-3 font-medium text-slate-500">Type</th>
                <th className="text-left p-3 font-medium text-slate-500">Active</th>
                <th className="text-left p-3 font-medium text-slate-500">Next Run</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.type}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3 text-xs">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
