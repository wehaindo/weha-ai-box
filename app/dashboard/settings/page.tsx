"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getConfig, setConfigField, getAppVersion, syncDeviceConfig, clearCredentials, runtimeCall } from "@/lib/device-config";

function formatLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

function formatSyncedAt(iso: string) {
  if (!iso) return "Never";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
      {children}
    </h2>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{children}</span>
    </div>
  );
}

function ConfigSection({ title, data }: { title: string; data: Record<string, any> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-slate-600">{formatLabel(key)}</span>
            <span className="text-sm font-medium text-slate-900">
              {typeof value === "boolean"
                ? value
                  ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">On</span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Off</span>
                : String(value ?? "\u2014")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type AuthStatus = "idle" | "checking" | "ok" | "error";

const NAV: { id: string; label: string; danger?: boolean }[] = [
  { id: "connection",     label: "Server Connection" },
  { id: "registration",   label: "Registration" },
  { id: "authentication", label: "Authentication" },
  { id: "credentials",    label: "Credentials" },
  { id: "device-config",  label: "Device Config" },
  { id: "about",          label: "About" },
  { id: "danger",         label: "Danger Zone", danger: true },
];

interface ConnectionState {
  serverUrl: string;
  saved: boolean;
}

interface RegistrationState {
  isRegistered: boolean;
  tenantId: string;
  deviceId: string;
  deviceToken: string;
  scopes: string[];
  registeredAt: string;
}

interface DeviceInfoState {
  deviceName: string;
  deviceType: string;
  deviceCode: string;
  storeName: string;
}

interface DeviceConfigState {
  deviceConfig: Record<string, any> | null;
  syncedAt: string;
  syncing: boolean;
  syncError: string;
  syncOk: boolean;
}

interface AuthState {
  status: AuthStatus;
  verifyResult: any;
  lastChecked: Date | null;
}

export default function SettingsPage() {
  const router = useRouter();

  const [connection, setConnection] = useState<ConnectionState>({ serverUrl: "", saved: false });
  const [reg, setReg] = useState<RegistrationState>({
    isRegistered: false, tenantId: "", deviceId: "", deviceToken: "",
    scopes: [], registeredAt: "",
  });
  const [device, setDevice] = useState<DeviceInfoState>({
    deviceName: "", deviceType: "", deviceCode: "", storeName: "",
  });
  const [devConfig, setDevConfig] = useState<DeviceConfigState>({
    deviceConfig: null, syncedAt: "", syncing: false, syncError: "", syncOk: false,
  });
  const [auth, setAuth] = useState<AuthState>({ status: "idle", verifyResult: null, lastChecked: null });
  const [appVersion, setAppVersion] = useState("\u2013");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("connection");
  const autoSyncDone = useRef(false);

  const load = useCallback(async () => {
    const config = await getConfig();
    setConnection(prev => ({ ...prev, serverUrl: config.serverUrl }));
    setReg({
      isRegistered: Boolean(config.deviceToken),
      tenantId: config.tenantId ?? "",
      deviceId: config.deviceId ?? "",
      deviceToken: config.deviceToken ?? "",
      scopes: config.scopes ?? [],
      registeredAt: config.registeredAt ?? "",
    });
    setDevConfig(prev => ({
      ...prev,
      deviceConfig: config.deviceConfig ?? null,
      syncedAt: config.deviceConfigSyncedAt ?? "",
    }));
    setDevice({
      deviceName: config.deviceName ?? "",
      deviceType: config.deviceType ?? "",
      deviceCode: config.deviceCode ?? "",
      storeName: config.storeName ?? "",
    });
    setAppVersion(await getAppVersion());
    setLoading(false);
    return { registered: Boolean(config.deviceToken), hasConfig: Boolean(config.deviceConfig) };
  }, []);

  const doSync = useCallback(async () => {
    setDevConfig(prev => ({ ...prev, syncing: true, syncError: "", syncOk: false }));
    try {
      const cfg = await syncDeviceConfig();
      const latest = await getConfig();
      setDevConfig(prev => ({
        ...prev,
        deviceConfig: cfg,
        syncedAt: new Date().toISOString(),
        syncing: false,
        syncError: "",
        syncOk: true,
      }));
      setDevice({
        deviceName: latest.deviceName ?? "",
        deviceType: latest.deviceType ?? "",
        deviceCode: latest.deviceCode ?? "",
        storeName: latest.storeName ?? "",
      });
      setTimeout(() => setDevConfig(prev => ({ ...prev, syncOk: false })), 3000);
    } catch (err: unknown) {
      setDevConfig(prev => ({
        ...prev,
        syncing: false,
        syncError: err instanceof Error ? err.message : "Sync failed",
      }));
    }
  }, []);

  const verifyAuth = useCallback(async () => {
    const config = await getConfig();
    if (!config.deviceToken) return;
    setAuth(prev => ({ ...prev, status: "checking", verifyResult: null }));
    try {
      const res = (await runtimeCall('POST', '/api/device/register-feature')) as {
        ok: boolean;
        status: number;
        data?: any;
        error?: string;
      };
      if (res.ok) {
        setAuth({ status: "ok", verifyResult: { device: res.data?.data?.device ?? res.data?.device }, lastChecked: new Date() });
      } else {
        setAuth({ status: "error", verifyResult: { error: res.error || res.data?.error || `HTTP ${res.status}` }, lastChecked: new Date() });
      }
    } catch (err: unknown) {
      setAuth({
        status: "error",
        verifyResult: { error: err instanceof Error ? err.message : "Network error" },
        lastChecked: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    load().then(({ registered, hasConfig }) => {
      if (registered && !hasConfig && !autoSyncDone.current) {
        autoSyncDone.current = true;
        doSync();
      }
    });
  }, [load, doSync]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await setConfigField("serverUrl", connection.serverUrl);
    setConnection(prev => ({ ...prev, saved: true }));
    setTimeout(() => setConnection(prev => ({ ...prev, saved: false })), 2500);
  }

  async function handleUnregister() {
    if (!confirm("Remove device credentials? You will need to re-register.")) return;
    await clearCredentials();
    router.replace("/register");
  }

  const configSections = useMemo(() => {
    const sections: { title: string; data: Record<string, any> }[] = [];
    const dc = devConfig.deviceConfig;
    if (!dc) return sections;
    const { features, settings, permissions, serial, platform, custom, ...rest } = dc as any;
    if (platform    && typeof platform    === "object" && !Array.isArray(platform))
      sections.push({ title: "Platform",    data: platform });
    if (features    && typeof features    === "object" && !Array.isArray(features))
      sections.push({ title: "Features",    data: features });
    if (settings    && typeof settings    === "object" && !Array.isArray(settings))
      sections.push({ title: "Settings",    data: settings });
    if (permissions && typeof permissions === "object" && !Array.isArray(permissions))
      sections.push({ title: "Permissions", data: permissions });
    if (serial      && typeof serial      === "object" && !Array.isArray(serial))
      sections.push({ title: "Serial Port", data: serial });
    if (custom      && typeof custom      === "object" && !Array.isArray(custom) && Object.keys(custom).length > 0)
      sections.push({ title: "Custom",      data: custom });
    const restEntries = Object.entries(rest).filter(([, v]) => typeof v !== "object" || v === null);
    if (restEntries.length > 0)
      sections.push({ title: "Other", data: Object.fromEntries(restEntries) });
    return sections;
  }, [devConfig.deviceConfig]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900">Weha AI Box</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-900">Dashboard</Link>
          <Link href="/dashboard/settings" className="font-medium text-blue-600">Settings</Link>
        </nav>
      </header>

      <div className="w-full px-4 py-8 flex gap-6 items-start">
        <aside className="hidden md:block w-52 shrink-0 sticky top-20">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</p>
          <nav className="space-y-0.5">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? "bg-blue-50 text-blue-700"
                    : item.danger
                    ? "text-red-500 hover:bg-red-50"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 px-3 py-2 flex gap-1.5 overflow-x-auto">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeSection === item.id
                  ? "bg-blue-600 text-white"
                  : item.danger
                  ? "bg-red-50 text-red-500 border border-red-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {activeSection === "connection" && (
            <div className="card p-6">
              <SectionLabel>
                <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Server Connection
              </SectionLabel>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="label" htmlFor="serverUrl">Server URL</label>
                  <input
                    id="serverUrl"
                    type="url"
                    className="input"
                    value={connection.serverUrl}
                    onChange={e => setConnection(prev => ({ ...prev, serverUrl: e.target.value }))}
                    placeholder="https://your-server.com"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Base URL used for all API calls to the Weha backend.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="submit" className="btn-primary text-sm">Save</button>
                  {connection.saved && <span className="text-sm text-green-600 font-medium">\u2713 Saved</span>}
                </div>
              </form>
            </div>
          )}

          {activeSection === "registration" && (
            <div className="card p-6 space-y-4">
              <SectionLabel>
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Registration
              </SectionLabel>
              {reg.isRegistered ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="badge-active">\u25cf Registered</span>
                    <span className="text-sm text-slate-500">This device has active credentials.</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    {device.deviceName && <Row label="Device Name"><span className="font-semibold">{device.deviceName}</span></Row>}
                    {device.deviceType && <Row label="Device Type"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{device.deviceType}</span></Row>}
                    {device.deviceCode && <Row label="Device Code"><span className="font-mono">{device.deviceCode}</span></Row>}
                    {device.storeName && <Row label="Store">{device.storeName}</Row>}
                    {reg.registeredAt && <Row label="Registered">{new Date(reg.registeredAt).toLocaleString()}</Row>}
                  </div>
                  <button className="btn-secondary text-sm" onClick={() => router.push("/register")}>
                    Re-register
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">This device is not registered yet.</p>
                  <button className="btn-primary text-sm" onClick={() => router.push("/register")}>
                    Register Device
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === "authentication" && (
            <div className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <SectionLabel>
                  <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Authentication
                </SectionLabel>
                <button
                  className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                  onClick={verifyAuth}
                  disabled={!reg.isRegistered || auth.status === "checking"}
                >
                  {auth.status === "checking" ? "Checking\u2026" : "Verify Now"}
                </button>
              </div>

              {!reg.isRegistered && (
                <p className="text-sm text-slate-400 italic">Register this device first.</p>
              )}
              {auth.lastChecked && (
                <p className="text-xs text-slate-400">Last checked: {auth.lastChecked.toLocaleTimeString()}</p>
              )}
              {auth.status === "idle" && reg.isRegistered && (
                <p className="text-sm text-slate-400">
                  Click <strong>Verify Now</strong> to test the device token against the server.
                </p>
              )}
              {auth.status === "checking" && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Verifying with server\u2026
                </div>
              )}
              {auth.status === "ok" && auth.verifyResult?.device && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-3">
                  <p className="font-medium text-green-800 text-sm">\u2713 Authentication successful</p>
                  <div className="rounded-lg border border-green-200 bg-white overflow-hidden">
                    <Row label="Device">{auth.verifyResult.device.deviceName}</Row>
                    <Row label="Active">{auth.verifyResult.device.isActive ? "Yes" : "No"}</Row>
                    {auth.verifyResult.device.store && <Row label="Store">{auth.verifyResult.device.store.name}</Row>}
                    {auth.verifyResult.device.permissions && (
                      <Row label="Permissions">
                        {Object.entries(auth.verifyResult.device.permissions).filter(([, v]) => v).map(([k]) => k).join(", ") || "None"}
                      </Row>
                    )}
                  </div>
                </div>
              )}
              {auth.status === "error" && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm">
                  <p className="font-medium text-red-800">\u2717 Authentication failed</p>
                  <p className="mt-1 text-xs text-red-600">{auth.verifyResult?.error}</p>
                </div>
              )}
            </div>
          )}

          {activeSection === "credentials" && (
            <div className="card p-6 space-y-4">
              <SectionLabel>
                <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Credentials
              </SectionLabel>
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <Row label="Server URL"><span className="font-mono text-xs break-all">{connection.serverUrl || "\u2014"}</span></Row>
                <Row label="Tenant ID"><span className="font-mono text-xs">{reg.tenantId || "\u2014"}</span></Row>
                <Row label="Device ID"><span className="font-mono text-xs">{reg.deviceId || "\u2014"}</span></Row>
                <Row label="Token">
                  <span className="font-mono text-xs">
                    {reg.deviceToken ? `${reg.deviceToken.substring(0, 16)}\u2026` : "\u2014"}
                  </span>
                </Row>
              </div>
              {reg.scopes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Scopes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {reg.scopes.map(s => (
                      <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-600">{s}</span>
                    ))}
                  </div>
                  {reg.isRegistered && !reg.scopes.includes("mcp:execute") && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">Missing "mcp:execute" scope</p>
                      <p className="mt-1 text-xs text-amber-700">
                        ERP-hosted MCP tools (e.g. inventory queries) will fail. Ask your administrator to grant the "mcp:execute"
                        scope to this device, then re-register it at /register.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === "device-config" && (
            <div className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <SectionLabel>
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Device Configuration
                </SectionLabel>
                <button
                  onClick={doSync}
                  disabled={!reg.isRegistered || devConfig.syncing}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {devConfig.syncing ? (
                    <><span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />Syncing\u2026</>
                  ) : (
                    <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Sync</>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {devConfig.syncedAt
                  ? <>Last synced: <span className="font-medium text-slate-500">{formatSyncedAt(devConfig.syncedAt)}</span></>
                  : "All settings are managed on the server. Press Sync to fetch the latest."}
              </p>
              {devConfig.syncError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">\u2715 {devConfig.syncError}</div>}
              {devConfig.syncOk    && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">\u2713 Synced successfully</div>}
              {!reg.isRegistered && <p className="text-sm text-slate-400 italic">Register this device first.</p>}
              {reg.isRegistered && !devConfig.deviceConfig && !devConfig.syncing && (
                <p className="text-sm text-slate-400 italic">No configuration loaded. Press <strong>Sync</strong> to fetch it.</p>
              )}
              {reg.isRegistered && (device.deviceName || device.deviceType || device.storeName) && (
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  {device.deviceName && <Row label="Device Name"><span className="font-semibold">{device.deviceName}</span></Row>}
                  {device.deviceType && <Row label="Device Type"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{device.deviceType}</span></Row>}
                  {device.deviceCode && <Row label="Device Code"><span className="font-mono text-xs">{device.deviceCode}</span></Row>}
                  {device.storeName  && <Row label="Store">{device.storeName}</Row>}
                </div>
              )}
              {configSections.length > 0 && (
                <div className="space-y-4 pt-2">
                  {configSections.map(s => <ConfigSection key={s.title} title={s.title} data={s.data} />)}
                </div>
              )}
            </div>
          )}

          {activeSection === "about" && (
            <div className="card p-6">
              <SectionLabel>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                About
              </SectionLabel>
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <Row label="Application">Weha AI Box</Row>
                <Row label="Version"><span className="font-mono">{appVersion}</span></Row>
                <Row label="Framework">Next.js</Row>
              </div>
            </div>
          )}

          {activeSection === "danger" && (
            <div className="card border-red-200 p-6 space-y-3">
              <SectionLabel>
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-red-700">Danger Zone</span>
              </SectionLabel>
              <p className="text-sm text-slate-500">
                Removing credentials will de-register this device. You will need a new activation token to re-register.
              </p>
              <button
                className="btn-danger text-sm"
                onClick={handleUnregister}
                disabled={!reg.isRegistered}
              >
                Remove Device Credentials
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
