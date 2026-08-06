"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveDeviceCredentials, setConfigField, runtimeCall } from "@/lib/device-config"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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
  const [serverUrl, setServerUrl] = useState("")
  const [activationToken, setActivationToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ActivateResponse | null>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let resolvedToken = activationToken.trim()
      try {
        const maybeUrl = new URL(resolvedToken)
        const tokenParam = maybeUrl.searchParams.get('token')
        if (tokenParam) {
          resolvedToken = tokenParam
          const origin = maybeUrl.origin
          if (origin && origin !== 'null') {
            setServerUrl(origin)
          }
        }
      } catch {
        // Not a URL — use as-is
      }

      const clientInfo = {
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      }

      if (!serverUrl) {
        throw new Error("Server URL is required")
      }

      const proxyRes = (await runtimeCall('POST', '/api/device/activate', {
        serverUrl,
        token: resolvedToken,
        clientInfo,
      })) as { ok: boolean; status: number; data?: any; error?: string }

      if (!proxyRes.ok) {
        throw new Error(proxyRes.error || proxyRes.data?.error || `Server returned ${proxyRes.status}`)
      }

      const { device, credentials } = proxyRes.data as ActivateResponse

      await saveDeviceCredentials(
        credentials.deviceToken,
        credentials.tenantId,
        device.id,
        device.name,
        device.deviceCode,
        device.deviceType,
        credentials.scopes
      )

      await setConfigField("serverUrl", serverUrl)

      runtimeCall('POST', '/api/erp/configure', {
        serverUrl,
        deviceToken: credentials.deviceToken,
        tenantId: credentials.tenantId,
        deviceId: device.id,
        deviceCode: device.deviceCode,
      }).catch((err) => console.warn('ERP auto-config:', err.message))

      setResult(proxyRes.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-1 text-xl font-bold text-foreground">Device Registered!</h2>
              <p className="mb-6 text-sm text-muted-foreground">{result.message}</p>

              <div className="mb-6 rounded-lg bg-muted p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{result.device.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-medium font-mono">{result.device.deviceCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{result.device.deviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store</span>
                  <span className="font-medium">{result.device.store?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scopes</span>
                  <span className="font-medium">{result.credentials.scopes.length}</span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-left mb-6">
                <p className="text-xs font-medium text-amber-800">⚠ Token saved to secure local store</p>
                <p className="text-xs text-amber-700 mt-1">The device token will not be shown again. It has been stored securely on this machine.</p>
              </div>

              <Button className="w-full" onClick={() => router.push("/dashboard")}>
                Go to Dashboard →
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <svg className="h-8 w-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Register Device</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the activation token generated by your system administrator.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-1">
                <Label htmlFor="serverUrl">Server URL</Label>
                <Input
                  id="serverUrl"
                  type="url"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  placeholder="https://your-server.com"
                  required
                />
                <p className="text-xs text-muted-foreground">The URL of the Weha backend server.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="token">Activation Token</Label>
                <Textarea
                  id="token"
                  className="font-mono text-xs min-h-[100px]"
                  value={activationToken}
                  onChange={e => setActivationToken(e.target.value)}
                  placeholder="Paste the full activation link or just the token (eyJ...)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste the <strong>full activation link</strong> or just the base64url token from the admin panel → Devices → Activate. The Server URL is filled in automatically when you paste the full link.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !activationToken.trim()}
                className="w-full"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Activating…
                  </span>
                ) : (
                  "Activate Device"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Weha Device Client · Need help? Contact your administrator.
        </p>
      </div>
    </div>
  )
}
