'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getConfig, runtimeCall } from '@/lib/device-config'
import type { DeviceConfig } from '@/lib/device-config'

export default function DashboardPage() {
  const [config, setConfig] = useState<DeviceConfig | null>(null)
  const [time, setTime] = useState(new Date())
  const erpConfigured = useRef(false)

  useEffect(() => {
    getConfig().then((cfg) => {
      setConfig(cfg)
      // Auto-configure runtime ERP from stored credentials on boot
      if (cfg.deviceToken && cfg.tenantId && cfg.serverUrl && !erpConfigured.current) {
        erpConfigured.current = true
        runtimeCall('POST', '/api/erp/configure', {
          serverUrl: cfg.serverUrl,
          deviceToken: cfg.deviceToken,
          tenantId: cfg.tenantId,
          deviceId: cfg.deviceId,
          deviceCode: cfg.deviceCode,
        }).catch((err) => console.warn('Boot ERP auto-config:', err.message))
      }
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  const deviceName = config?.deviceName
  const storeName = config?.storeName

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 relative">
      {/* Settings gear */}
      <Link
        href="/dashboard/settings"
        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 transition-colors"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Link>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center space-y-6">
          {/* Time */}
          <div className="text-7xl sm:text-8xl font-bold text-slate-900 tabular-nums tracking-tight">
            {timeStr}
          </div>

          {/* Date */}
          <div className="text-xl sm:text-2xl text-slate-500 font-medium">
            {dateStr}
          </div>

          {/* Continue button */}
          <div className="pt-4">
            <Link
              href="/dashboard/apps"
              className="inline-block rounded-xl bg-blue-600 px-12 py-4 text-lg font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-lg shadow-blue-600/25"
            >
              Continue
            </Link>
          </div>
        </div>
      </div>

      {/* Device info footer */}
      {deviceName && (
        <div className="pb-6 text-center text-sm text-slate-400">
          Device · {deviceName}{storeName ? ` — ${storeName}` : ''}
        </div>
      )}
    </div>
  )
}
