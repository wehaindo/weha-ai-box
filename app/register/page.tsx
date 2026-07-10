"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getConfig, saveDeviceCredentials, runtimeCall } from "@/lib/device-config"

interface ActivateResponse {
  device: {
    id: string
    name: string
    deviceCode: string
    deviceType: string
    store: { id: string; name: string; address?: string }
  }
  credentials: {
    deviceToken: string
    tenantId: string
    encodedCredentials: string
    tokenId: string
    scopes: string[]
  }
  message: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [serverUrl, setServerUrl] = useState("http://localhost:3000")
  const [activationToken, setActivationToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ActivateResponse | null>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // If user pasted the full activation URL, extract just the token param
      let resolvedToken = activationToken.trim()
      try {
        const maybeUrl = new URL(resolvedToken)
        const tokenParam = maybeUrl.searchParams.get('token')
        if (tokenParam) {
          resolvedToken = tokenParam
          // Also auto-fill server URL from the pasted link
          const origin = maybeUrl.origin
          if (origin && origin !== 'null') {
            setServerUrl(origin)
          }
        }
      } catch {
        // Not a URL — use as-is (plain base64url token)
      }

      // Gather basic client info
      const clientInfo = {
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      }

      const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/device/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resolvedToken, clientInfo }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`)
      }

      const { device, credentials } = data as ActivateResponse

      // Persist to Electron store
      await saveDeviceCredentials(
        credentials.deviceToken,
        credentials.tenantId,
        device.id,
        device.name,
        device.deviceCode,
        device.deviceType,
        credentials.scopes
      )

      // Also save server URL
      if (window.electronAPI) {
        await window.electronAPI.set("serverUrl", serverUrl)
      }

      // Configure runtime ERP with the same credentials
      runtimeCall('POST', '/api/erp/configure', {
        serverUrl,
        deviceToken: credentials.deviceToken,
        tenantId: credentials.tenantId,
        deviceId: device.id,
        deviceCode: device.deviceCode,
      }).catch((err) => console.warn('ERP auto-config:', err.message))

      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">
          {/* Success card */}
          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-1 text-xl font-bold text-slate-900">Device Registered!</h2>
            <p className="mb-6 text-sm text-slate-500">{result.message}</p>

            <div className="mb-6 rounded-lg bg-slate-50 p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-medium">{result.device.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Code</span>
                <span className="font-medium font-mono">{result.device.deviceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="font-medium">{result.device.deviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store</span>
                <span className="font-medium">{result.device.store?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scopes</span>
                <span className="font-medium">{result.credentials.scopes.length}</span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-left mb-6">
              <p className="text-xs font-medium text-amber-800">⚠ Token saved to secure local store</p>
              <p className="text-xs text-amber-700 mt-1">The device token will not be shown again. It has been stored securely on this machine.</p>
            </div>

            <button
              className="btn-primary w-full"
              onClick={() => router.push("/dashboard")}
            
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Register Device</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the activation token generated by your system administrator.
          </p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Server URL */}
            <div>
              <label className="label" htmlFor="serverUrl">
                Server URL
              </label>
              <input
                id="serverUrl"
                type="url"
                className="input"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="https://your-server.com"
                required
              />
              <p className="mt-1 text-xs text-slate-400">The URL of the Weha backend server.</p>
            </div>

            {/* Activation token */}
            <div>
              <label className="label" htmlFor="token">
                Activation Token
              </label>
              <textarea
                id="token"
                rows={4}
                className="input resize-none font-mono text-xs"
                value={activationToken}
                onChange={e => setActivationToken(e.target.value)}
                placeholder="Paste the full activation link or just the token (eyJ...)"
                required
              />
              <p className="mt-1 text-xs text-slate-400">
                Paste the <strong>full activation link</strong> or just the base64url token from the admin panel → Devices → Activate. The Server URL is filled in automatically when you paste the full link.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !activationToken.trim()}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Activating…
                </span>
              ) : (
                "Activate Device"
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Weha Device Client · Need help? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
