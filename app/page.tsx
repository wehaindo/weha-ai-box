'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRegistered } from '@/lib/device-config'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function boot() {
      try {
        const registered = await isRegistered()
        if (registered) {
          router.push('/dashboard')
        } else {
          router.push('/register')
        }
      } catch {
        router.push('/register')
      }
    }
    boot().finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Starting WEHA AI Box…</p>
        </div>
      </div>
    )
  }

  return null
}
