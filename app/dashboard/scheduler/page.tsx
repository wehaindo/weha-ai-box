'use client';

import { useEffect, useState, memo } from 'react';
import { runtimeCall } from '@/lib/device-config';

const ScheduleRow = memo(function ScheduleRow({ schedule }: { schedule: any }) {
  return (
    <tr className="border-b last:border-0 hover:bg-slate-50">
      <td className="p-3">{schedule.name}</td>
      <td className="p-3">{schedule.type}</td>
      <td className="p-3">
        <span className={`px-2 py-1 rounded-full text-xs ${
          schedule.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {schedule.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="p-3 text-xs">{schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '\u2014'}</td>
    </tr>
  );
});

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runtimeCall('GET', '/api/schedules').then((res: any) => {
      if (res?.data) setSchedules(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scheduler</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Create Schedule</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading\u2026</div>
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
                <ScheduleRow key={s.id} schedule={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
