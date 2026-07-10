"use client"

import { useState, useEffect, useCallback } from "react"
import { getConfig, DeviceConfig } from "@/lib/device-config"

export function useDevice() {
  const [config, setConfig] = useState<DeviceConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const c = await getConfig()
      setConfig(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { config, loading, refresh }
}
