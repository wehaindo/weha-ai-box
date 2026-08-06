'use client';

import { useEffect, useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { runtimeCall } from '@/lib/device-config';

const badge = (status: string) => {
  const c: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    WAITING_APPROVAL: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-slate-100 text-slate-800',
  };
  return c[status] || 'bg-slate-100 text-slate-800';
};

const ExecutionRow = memo(function ExecutionRow({
  execution,
  onSelect,
}: {
  execution: any;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(execution.executionId)}
      className="border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors"
    >
      <td className="p-3 font-mono text-xs">{execution.executionId}</td>
      <td className="p-3 text-slate-700">{execution.agent?.name || execution.agentId}</td>
      <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${badge(execution.status)}`}>{execution.status}</span></td>
      <td className="p-3">{execution.trigger}</td>
      <td className="p-3 text-slate-400">{new Date(execution.createdAt).toLocaleString()}</td>
    </tr>
  );
});

export default function ExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runtimeCall('GET', '/api/executions').then((res: any) => {
      if (res?.data) setExecutions(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Executions</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading\u2026</div>
        ) : executions.length === 0 ? (
          <div className="p-6 text-center text-slate-400">No executions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-500">Execution ID</th>
                <th className="text-left p-3 font-medium text-slate-500">Agent</th>
                <th className="text-left p-3 font-medium text-slate-500">Status</th>
                <th className="text-left p-3 font-medium text-slate-500">Trigger</th>
                <th className="text-left p-3 font-medium text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e: any) => (
                <ExecutionRow key={e.id} execution={e} onSelect={(id) => router.push(`/dashboard/executions/${id}`)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
