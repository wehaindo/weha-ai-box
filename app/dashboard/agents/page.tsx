'use client';

import { useEffect, useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { runtimeCall } from '@/lib/device-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const AgentRow = memo(function AgentRow({
  agent,
  runningId,
  onRun,
}: {
  agent: any;
  runningId: string | null;
  onRun: (id: string) => void;
}) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/50">
      <td className="p-3 font-medium">{agent.name}</td>
      <td className="p-3 text-muted-foreground">v{agent.version}</td>
      <td className="p-3">
        <Badge variant={agent.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {agent.status}
        </Badge>
      </td>
      <td className="p-3 text-xs text-muted-foreground">
        {agent.deployedAt ? new Date(agent.deployedAt).toLocaleString() : '\u2014'}
      </td>
      <td className="p-3">
        <Button
          size="sm"
          onClick={() => onRun(agent.agentId)}
          disabled={runningId === agent.agentId}
        >
          {runningId === agent.agentId ? 'Running\u2026' : 'Run'}
        </Button>
      </td>
    </tr>
  );
});

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    runtimeCall('GET', '/api/agents').then((res: any) => {
      if (res?.data) setAgents(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function runAgent(agentId: string) {
    setRunningId(agentId);
    try {
      const agentRes = await runtimeCall('GET', `/api/agents/${agentId}`) as any;
      const definition = agentRes?.data?.definition;
      if (!definition) throw new Error('Agent definition not found');
      await runtimeCall('POST', '/api/executions', {
        agentId,
        agentDefinition: definition,
        trigger: 'MANUAL',
        input: {},
      });
      router.push('/dashboard/executions');
    } catch (err: any) {
      alert(err?.message || 'Failed to run agent');
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Agents</h1>
      </div>
      <Card>
        {loading ? (
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading agents...
          </CardContent>
        ) : agents.length === 0 ? (
          <CardContent className="p-6 text-center text-muted-foreground">
            No agents synced yet. Go to App Settings and click "Sync Agents Now".
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Synced Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Version</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Deployed</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a: any) => (
                    <AgentRow key={a.agentId} agent={a} runningId={runningId} onRun={runAgent} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
