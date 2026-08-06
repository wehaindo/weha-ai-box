'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, AppWindow, Bot, Play, Clock, Settings, ChevronLeft, ChevronRight, Wrench, GitBranch, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Apps', href: '/dashboard/apps', icon: AppWindow },
  { label: 'AI Chat', href: '/dashboard/chat', icon: MessageSquareText },
  { label: 'Agent Builder', href: '/dashboard/agent-builder', icon: GitBranch },
  { label: 'MCP Builder', href: '/dashboard/mcp-builder', icon: Wrench },
  { label: 'Agents', href: '/dashboard/agents', icon: Bot },
  { label: 'Executions', href: '/dashboard/executions', icon: Play },
  { label: 'Scheduler', href: '/dashboard/scheduler', icon: Clock },
  { label: 'App Settings', href: '/dashboard/apps/settings', icon: Settings },
];

const standalonePaths = new Set(['/dashboard', '/dashboard/settings']);

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (standalonePaths.has(pathname)) return null;

  return (
    <aside
      className={cn(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex items-center gap-2 p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          W
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-gray-800 dark:text-white">WEHA AI Box</span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-amber-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center gap-2 p-3 border-t border-gray-100 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
      >
        {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
      </button>
    </aside>
  );
}
