'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
  { label: 'Apps', href: '/dashboard/apps', icon: '▦' },
  { label: 'Agents', href: '/dashboard/agents', icon: '⚙' },
  { label: 'Executions', href: '/dashboard/executions', icon: '▶' },
  { label: 'Scheduler', href: '/dashboard/scheduler', icon: '⏰' },
  { label: 'App Settings', href: '/dashboard/apps/settings', icon: '⚡' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isStandalone = pathname === '/dashboard' || pathname === '/dashboard/settings'

  if (isStandalone) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-slate-900 text-white transition-all duration-200 flex flex-col`}>
        <div className="p-4 border-b border-slate-700">
          <h1 className={`font-bold text-sm ${collapsed ? 'text-center' : ''}`}>
            {collapsed ? 'AI' : 'WEHA AI Box'}
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-slate-700 text-slate-400 hover:text-white text-xs"
        >
          {collapsed ? '→' : 'Collapse'}
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
