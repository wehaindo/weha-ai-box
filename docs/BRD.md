# WEHA AI Box — Business Requirements Document

## Version 5.0 — July 2026

---

## 1. Executive Summary

| Field | Value |
|-------|-------|
| **Product** | WEHA AI Box |
| **Type** | On-premises Agent Execution Platform |
| **Ecosystem** | WEHA ERP (Control Plane) |
| **Deployment** | Customer premises, fully offline capable |
| **License** | Per-device license validated via WEHA Cloud |
| **Desktop Scaffold** | Two-layer architecture: **Device Layer** forked from `weha-boilerplate-device` (Electron 33 + Next.js + shadcn) + **Apps Layer** for AI Box management |
| **ERP Auth** | Device Activation Flow (`weha-boilerplate-device` pattern) |
| **UI Flow** | Boot → Register/Login → Clock Dashboard → Continue → AI Box Apps Area |
| **Implementation Status** | **Phases 1-6 complete** (Foundation, Runtime Engine, ERP/MCP, Notifications, Desktop, Sync). **Phases 7-8 future** (AI Runtime, Production Hardening) |

**One-line description:** WEHA AI Box executes deterministic business agents published from WEHA ERP Agent Builder on customer premises.

**Critical constraint:** WEHA AI Box is NOT a chatbot. It is an Agent Execution Platform for WEHA ERP.

---

## 2. UI Architecture

### 2.1 Two-Layer Navigation Model

The application is split into two layers, each with distinct navigation patterns:

**Device Layer** (boilerplate device) — Standalone full-screen pages for device management:

| Route | Page | Access |
|-------|------|--------|
| `/` | Boot flow → redirect to `/register` or `/dashboard` | App start |
| `/register` | Device registration (paste activation token) | Registration link |
| `/login` | Local JWT login (email/password) | After registration, or manual logout |
| `/dashboard` | Clock dashboard (live clock + date + continue button) | App start (registered) |
| `/dashboard/settings` | Device settings (7 sections: Connection, Registration, Authentication, Credentials, Device Config, About, Danger Zone) | Clock gear icon |

The device layer is full-screen with **no sidebar**. `/dashboard` and `/dashboard/settings` render standalone without the sidebar layout. It mirrors `weha-boilerplate-device` exactly and handles device lifecycle (registration, login, credentials, ERP connection, config sync, authentication verification, unregister).

**Apps Layer** (AI Box) — Sidebar-based navigation for AI Box management. The sidebar renders on all routes EXCEPT `/dashboard` and `/dashboard/settings`:

| Route | Page | Access |
|-------|------|--------|
| `/dashboard` | Dashboard home (redirect target, also standalone clock) | Sidebar "Dashboard" |
| `/dashboard/apps` | AI Box Overview dashboard | Clock "Continue" button |
| `/dashboard/apps/settings` | App Settings (4 tabs: General, ERP, MCP, Notifications) | Sidebar "App Settings" |
| `/dashboard/agents` | Agent management | Sidebar |
| `/dashboard/executions` | Execution monitoring | Sidebar |
| `/dashboard/scheduler` | Schedule management | Sidebar |

The apps layer uses a **collapsible sidebar** with WEHA AI Box branding for navigation. The sidebar contains 6 items: Dashboard, Apps, Agents, Executions, Scheduler, App Settings.

### 2.2 Navigation Flow

```
App Start
  │
  ▼
/ (Boot)
  │
  ├── Not registered → /register → Paste token → Registered
  │
  ├── Registered, no session → /login → JWT login → /dashboard
  │
  └── Registered + session → /dashboard (Clock + Continue)
                               │
                               ├── Gear icon → /dashboard/settings (Device Settings)
                               │
                               └── Continue → /dashboard/apps (AI Box Overview)
                                                │
                                                ├── Sidebar → Agents / Executions / Scheduler
                                                │
                                                └── App Settings card → /dashboard/apps/settings
```

### 2.3 Separation of Settings

Two distinct settings pages serve different purposes:

| | Device Settings | App Settings |
|--|----------------|--------------|
| **Route** | `/dashboard/settings` | `/dashboard/apps/settings` |
| **Scope** | Device lifecycle | AI Box runtime |
| **Sections** | Connection, Registration, Auth, Credentials, Device Config, About, Danger Zone | General, ERP, MCP, Notifications |
| **Access** | Clock gear icon | Sidebar "App Settings", Apps page card |
| **Source** | Ported from `weha-boilerplate-device` | Built for AI Box |

---

## 3. Business Objectives

| ID | Objective | Priority | Status / Success Metric |
|----|-----------|----------|------------------------|
| BO-01 | Execute ERP agents deterministically without AI | P0 (Critical) | ✅ Implemented — 100% of agent executions complete without AI involvement when deterministic paths exist |
| BO-02 | Operate fully offline | P0 (Critical) | ⚠️ Partially — core execution engine, scheduler, notification gateway work offline. ERP connector requires network for live queries; local cache not yet implemented |
| BO-03 | Survive process crashes and system reboots | P0 (Critical) | ⚠️ Partially — checkpoints persisted before each node transition. Full recovery loop (rebuild in-memory state from DB) not yet implemented |
| BO-04 | Support concurrent multi-agent execution | P1 (High) | ✅ Architectural support for 100+ concurrent executions. Actual throughput not yet benchmarked |
| BO-05 | Enable human-in-the-loop approvals | P1 (High) | ✅ Implemented — approval notifications via 6 channels; agent pauses and resumes on approval response |
| BO-06 | Optional AI reasoning | P2 (Medium) | ⬜ **Phase 7 (future)** — Python AI Runtime is a separate project. Current codebase contains only a stub prompt node |
| BO-07 | Multi-platform support | P1 (High) | ✅ Electron packaging configured for Windows (NSIS), Linux (deb/rpm/AppImage), macOS (dmg) |
| BO-08 | Secure by default | P0 (Critical) | ✅ Implemented — zero inbound ports required; all communication is outbound HTTPS; secrets encrypted at rest (AES-256-GCM) |

---

## 4. Target Audience

| User Role | Responsibility | Key Needs |
|-----------|---------------|-----------|
| **ERP Administrator** | Creates and publishes agents from WEHA ERP Agent Builder | Reliable agent execution, detailed execution logs, error diagnostics |
| **Business User** | Receives notifications and submits approvals | Fast notification delivery, simple approval UI (Telegram, WHOTIF), clear task inbox |
| **IT Operator** | Installs, configures, and monitors the appliance | Health dashboard, easy installation, automated updates, remote diagnostics, log aggregation |

---

## 5. Authentication & Authorization

### 5.1 ERP Authentication — Device Activation Flow

AI Box authenticates with WEHA ERP using the **same device activation flow** as `weha-boilerplate-device`.

**Registration Flow:**

```
ERP Admin                          AI Box                           WEHA ERP
    │                                │                                │
    │  Generate Activation Token     │                                │
    │  (in tenant DB)                │                                │
    │────────────────────────────────┼───────────────────────────────>│
    │                                │                                │
    │  Share activation link/token   │                                │
    │───────────────────────────────>│                                │
    │                                │  POST /api/device/activate     │
    │                                │  { token: "<base64url>" }      │
    │                                │───────────────────────────────>│
    │                                │                                │
    │                                │  Response:                     │
    │                                │  { deviceToken: "dev_live_…",  │
    │                                │    tenantId: "tnt_xxx",        │
    │                                │    encodedCredentials,         │
    │                                │    tokenId, scopes }           │
    │                                │<───────────────────────────────│
    │                                │                                │
    │  Store in electron-store       │                                │
    │  (deviceToken + tenantId)      │                                │
    │                                │                                │
```

**Every subsequent request to ERP:**

| Header | Value | Source |
|--------|-------|--------|
| `Authorization` | `Bearer <deviceToken>` | Stored in electron-store after activation |
| `X-Tenant-ID` | `<tenantId>` | Stored in electron-store after activation |

**Token format:** `dev_live_<64 hex chars>` (production) or `dev_test_<64 hex chars>` (testing)

**Token validation (server-side):**
- Server hashes the token with SHA-256
- Looks up hash in `ApiToken` table (`tokenType: 'DEVICE'`)
- Validates token is active, not expired, belongs to correct tenant
- Updates `lastUsedAt` and device `lastHeartbeat`

**ERP Connector in Node Runtime** uses these stored credentials for all ERP API calls. The Electron desktop only stores and manages the credentials — it never calls ERP directly.

### 5.2 Local Authentication (AI Box Desktop)

The Electron desktop uses its own **local JWT authentication** for user login. After device registration, the user logs in at `/login` with email and password. The Node Runtime issues a JWT that the desktop sends as `Authorization: Bearer <jwt>` on all subsequent API calls.

**Login Flow:**

```
User                    Desktop UI                    Node Runtime
  │                         │                            │
  │  Enter email + password  │                            │
  │────────────────────────>│                            │
  │                         │  POST /api/auth/login       │
  │                         │  { email, password }        │
  │                         │───────────────────────────>│
  │                         │                            │
  │                         │  Response:                  │
  │                         │  { token: "jwt_xxx",        │
  │                         │    user: { id, email,       │
  │                         │      role, name } }         │
  │                         │<───────────────────────────│
  │                         │                            │
  │  Store JWT, redirect    │                            │
  │  to /dashboard          │                            │
  │<────────────────────────│                            │
```

| Role | Permissions |
|------|------------|
| **Admin** | Full system access: manage users, roles, plugins, settings, deploy agents |
| **Operator** | Monitor executions, view logs, manage agents, view settings |
| **Viewer** | Read-only dashboard and execution monitoring |

Local JWT tokens are issued by the Node Runtime and are independent from ERP authentication. The local auth is for the management UI only.

---

## 6. Functional Requirements

### 6.1 User Interface (FR-UI)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-UI-01 | Clock dashboard as landing page | Live clock updating every second, current date, settings gear icon, Continue button |
| FR-UI-02 | Device settings standalone | 7-section settings page without sidebar (Connection, Registration, Auth, Credentials, Device Config, About, Danger Zone) |
| FR-UI-03 | AI Box Overview dashboard | Runtime health, agent count, execution stats (total/running/completed/failed/pending), schedule count, 4 quick-link cards (Agents, Executions, Scheduler, App Settings) |
| FR-UI-04 | App Settings with sidebar | 4-tab settings (General, ERP, MCP, Notifications) accessible from sidebar and apps page |
| FR-UI-05 | Collapsible sidebar | 6 nav items (Dashboard, Apps, Agents, Executions, Scheduler, App Settings); WEHA AI Box branding |
| FR-UI-06 | Two-layer separation | Device layer (full-screen, no sidebar — `/dashboard`, `/dashboard/settings`) vs Apps layer (sidebar-based); clear visual separation |
| FR-UI-07 | Login page | Email/password form at `/login`; JWT stored client-side; redirect to `/dashboard` on success |

### 6.2 Agent Execution Engine (FR-AE)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-AE-01 | Parse and validate Agent JSON | Schema validation, checksum verification, signature verification |
| FR-AE-02 | Execute directed acyclic graphs (DAG) | Topological sort, parallel branch execution, loop iteration |
| FR-AE-03 | Support node categories | **25 node types implemented** across 5 categories: Core (8), Utility (5), Business (5), MCP (2), Communication (5). **13 remaining** for Phase 7: Knowledge (5), AI (7 + 1 stub). See §13 for breakdown |
| FR-AE-04 | Pause, resume, cancel, retry, rollback operations | All operations available via API; state transitions are atomic |
| FR-AE-05 | Checkpoint every node transition | Checkpoint persisted to PostgreSQL before next node executes |
| FR-AE-06 | Variable scoping and transformation | Input variables, node-local variables, global variables, expression-based transforms |
| FR-AE-07 | Error handling strategies | Per-agent configurable: stop, continue, retry (with backoff), rollback |

### 6.3 ERP Connector (FR-EC)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-EC-01 | Authenticate with WEHA ERP via device activation flow | Uses `Authorization: Bearer <deviceToken>` + `X-Tenant-ID` headers; follows `weha-boilerplate-device` auth pattern |
| FR-EC-02 | Execute CRUD operations | Full create, read, update, delete on ERP entities |
| FR-EC-03 | Trigger ERP workflows | Call ERP workflow engine with input parameters |
| FR-EC-04 | Submit and review approvals | Create approval requests, poll for status, receive callbacks |
| FR-EC-05 | Cache ERP data locally | ⬜ **Planned** — not yet implemented. Currently all ERP queries are live; no local cache layer |
| FR-EC-06 | Never expose ERP directly to Electron | All ERP communication happens in Node Runtime; Electron uses only the local API Gateway |

### 6.4 MCP Runtime (FR-MCP)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-MCP-01 | Dynamic MCP server discovery | Connect to MCP servers via URL, discover available tools |
| FR-MCP-02 | Tool execution | Execute MCP tools with parameter validation, timeout, retry |
| FR-MCP-03 | Circuit breaker | Automatic disable after N consecutive failures; periodic health check for recovery |
| FR-MCP-04 | Credential vault | Encrypted storage for MCP server credentials; access-controlled |

### 6.5 Notification Gateway (FR-NG)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-NG-01 | Unified notification API | `sendNotification()`, `sendApproval()`, `sendAlert()` with channel-agnostic payload |
| FR-NG-02 | Multi-channel delivery | WHOTIF (primary), Telegram, Email, WebSocket, Firebase Cloud Messaging, SMS |
| FR-NG-03 | Channel routing | Per-agent, per-user, per-notification-type channel selection rules |
| FR-NG-04 | Approval response handling | Capture approval response and resume paused agent execution |

### 6.6 Scheduler (FR-SC)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-SC-01 | Cron-based scheduling | Standard cron expressions with timezone support |
| FR-SC-02 | One-time scheduling | Schedule agent for single execution at a future time |
| FR-SC-03 | Recurring scheduling | Configurable intervals (every N minutes/hours/days) |
| FR-SC-04 | Event triggers | ⬜ **Planned** — only manual trigger and scheduled cron/one-time/recurring triggers are implemented. ERP events, webhooks, MCP event triggers are future |
| FR-SC-05 | Missed execution recovery | ⬜ **Planned** — not yet implemented. Scheduler has no catch-up logic for missed executions |

### 6.7 Synchronization Engine (FR-SE)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-SE-01 | Outbound-only connection | All communication initiated by AI Box; no inbound ports required |
| FR-SE-02 | Heartbeat | Periodic (configurable interval) status report to WEHA Cloud |
| FR-SE-03 | Agent sync | Pull new/updated agent definitions from WEHA Cloud |
| FR-SE-04 | Plugin sync | ⬜ **Planned** — plugin manager exists for local filesystem discovery, but cloud plugin sync is not implemented |
| FR-SE-05 | Configuration sync | Push/pull configuration changes |
| FR-SE-06 | License validation | Validate license periodically; grace period for offline operation |
| FR-SE-07 | Remote command execution | Execute restart, deploy, rollback, log collection commands from WEHA Cloud |

### 6.8 Monitoring & Dashboard (FR-MD)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-MD-01 | System health monitoring | CPU, memory, disk, database connection, Redis connection |
| FR-MD-02 | Runtime health monitoring | Node Runtime process, plugin status, queue depth |
| FR-MD-03 | Execution monitoring | Active executions, completed, failed, pending, execution duration |
| FR-MD-04 | Connectivity monitoring | ERP, MCP, Telegram, WHOTIF connection status |
| FR-MD-05 | AI usage tracking | ⬜ **Planned** — AiUsage database model exists but no tracking code implemented |
| FR-MD-06 | Real-time updates | ⬜ **Planned** — WebSocket provider exists in notification gateway but no server-side push mechanism is active |
| FR-MD-07 | AI Box Overview dashboard | Runtime health card, agent count, execution stats (total/running/completed/failed/pending), schedule count |
| FR-MD-08 | Quick-link navigation | 4 cards linking to Agents, Executions, Scheduler, App Settings from overview |

### 6.9 Security (FR-SEC)

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| FR-SEC-01 | ERP authentication via device activation flow | Uses `dev_live_xxx` token with `Authorization: Bearer` + `X-Tenant-ID` headers |
| FR-SEC-02 | Local JWT for desktop UI | Admin, Operator, Viewer roles; tokens expire and refresh |
| FR-SEC-03 | Encrypted secrets at rest | Database encryption for credentials, API keys, tokens |
| FR-SEC-04 | Encrypted secrets in transit | TLS for all HTTP connections |
| FR-SEC-05 | RBAC | Admin, Operator, Viewer roles; granular plugin-level permissions |
| FR-SEC-06 | Tenant isolation | Multi-tenant support with complete data isolation |
| FR-SEC-07 | Audit log | Immutable audit trail for all operations: agent deploy, execution start/stop, config change, user action |
| FR-SEC-08 | Plugin permission system | Each plugin declares required permissions; runtime enforces grants |

---

## 7. Non-Functional Requirements

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR-01 | **Offline capability** | Core execution, scheduler, notification gateway must work without internet. ERP queries require network | ⚠️ Partial — scheduler and notification gateway work offline. ERP connector requires live queries; no local cache yet |
| NFR-02 | **Startup time** | System operational in <5s from process start | ⬜ Not verified |
| NFR-03 | **Deterministic node latency** | <100ms per non-AI node transition | ⬜ Not benchmarked |
| NFR-04 | **AI node latency** | <2s local AI, <10s external AI | ⬜ Phase 7 — AI not implemented |
| NFR-05 | **Throughput** | 100+ concurrent agent executions | ⬜ Not benchmarked |
| NFR-06 | **Reliability** | 99.9% uptime (excluding host OS failures) | ⬜ Not measured |
| NFR-07 | **State persistence** | Zero data loss on process crash; every checkpoint is ACID | ⚠️ Partial — checkpoints persisted before each node. Full recovery loop (rebuild state from DB on restart) not yet implemented |
| NFR-08 | **Upgrade** | Zero-downtime plugin updates via hot-reload | ⬜ Not tested |
| NFR-09 | **Memory** | Base: <256MB RSS; per active execution: <50MB additional | ⬜ Not measured |
| NFR-10 | **Storage** | Agent definitions: <1MB each; Execution checkpoints: <10KB each | ✅ Architecturally supported |
| NFR-11 | **Encryption** | AES-256-GCM for secrets; TLS 1.3 for transport | ✅ Implemented (credential vault, TLS support) |
| NFR-12 | **Maximum agent size** | 10MB per Agent JSON definition | ✅ Validated in schema |
| NFR-13 | **Maximum graph depth** | 500 nodes per agent | ✅ Validated in DAG validator |
| NFR-14 | **Maximum parallel branches** | 50 concurrent branches per execution | ✅ Architecturally supported |
| NFR-15 | **Queue implementation** | In-memory notification queue (BullMQ/Redis planned for Phase 8) | ⚠️ In-memory only — no persistence across restarts |
| NFR-16 | **Test coverage** | No test infrastructure yet | ⬜ Planned for Phase 8 |

---

## 8. Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| C-01 | Agents stored as JSON only — never executable code | Security: no arbitrary code execution; all logic is declared in the graph |
| C-02 | Electron manages UI only — never executes agents | Separation of concerns; desktop app is management console only |
| C-03 | Node Runtime has zero AI logic | Clean architecture; AI is externalized to a separate Python service |
| C-04 | Python AI Runtime is a **separate project** (outside this repository) | Deployed via Docker; communicates with Node Runtime via REST. Not included in current build |
| C-05 | AI is always last resort (architectural principle) | Execution priority concept: Rule → ERP → Workflow → MCP → Notification → AI. AI nodes currently stubs (Phase 7) |
| C-06 | No inbound ports required | Zero-trust security model; all communication is outbound |
| C-07 | Must integrate with existing WEHA ecosystem | Leverage existing WHOTIF, Telegram, ERP, and auth infrastructure |
| C-08 | Two-layer architecture: Device Layer (boilerplate) + Apps Layer (AI Box) | Device layer handles lifecycle (registration, login, credentials, config sync); Apps layer handles AI Box management (agents, executions, scheduler). Each layer has its own settings page |
| C-09 | Device layer is full-screen standalone | `/dashboard` and `/dashboard/settings` render without sidebar — mirroring `weha-boilerplate-device` UX |
| C-10 | Apps layer uses sidebar navigation | Collapsible sidebar with 6 nav items; rendered for all routes except `/dashboard` and `/dashboard/settings` |
| C-11 | Queue implementation uses in-memory storage (BullMQ/Redis planned) | Notification queue and scheduler use in-memory data structures. No persistence across process restarts for queued items |

---

## 9. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WEHA Cloud (Control Plane)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ WEHA ERP SaaS  │  │ Agent Publisher │  │ Cloud Sync Endpoint   │ │
│  │     (ERP)      │  │ (Agent Builder) │  │ (license, commands)   │ │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘ │
└──────────┼──────────────────┼────────────────────────┼───────────────┘
           │ Device Auth      │ HTTPS (sync)           │ HTTPS
           │ (Bearer + X-TID) │                        │
           ▼                  ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    WEHA AI Box (Customer Premises)                     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │  Electron Desktop — Two-Layer Architecture                    │      │
│  │                                                               │      │
│  │  ┌─── DEVICE LAYER (full-screen, no sidebar) ──────────┐    │      │
│  │  │                                                       │    │      │
│  │  │  /                    Boot flow (→/register or        │    │      │
│  │  │                       →/dashboard)                    │    │      │
│  │  │  /register            Device Registration              │    │      │
│  │  │  /dashboard           Clock Dashboard (live clock      │    │      │
│  │  │                       + Continue button)               │    │      │
│  │  │  /dashboard/settings  Device Settings                  │    │      │
│  │  │                       (7 sections)                     │    │      │
│  │  │                                                       │    │      │
│  │  │  Ported from weha-boilerplate-device                  │    │      │
│  │  └───────────────────────────────────────────────────────┘    │      │
│  │                                                               │      │
│  │  ┌─── APPS LAYER (sidebar navigation) ──────────────────┐    │      │
│  │  │                                                       │    │      │
│  │  │  /dashboard/apps           AI Box Overview            │    │      │
│  │  │  /dashboard/apps/settings  App Settings (4 tabs)      │    │      │
│  │  │  /dashboard/agents         Agent management           │    │      │
│  │  │  /dashboard/executions     Execution monitoring       │    │      │
│  │  │  /dashboard/scheduler      Schedule management        │    │      │
│  │  │                                                       │    │      │
│  │  │  Sidebar: Apps | Agents | Executions | Scheduler |   │    │      │
│  │  │           App Settings                                │    │      │
│  │  └───────────────────────────────────────────────────────┘    │      │
│  └──────────────────────────┬──────────────────────────────────┘      │
│                             │ Local API (REST + WS)                   │
│  ┌──────────────────────────┴──────────────────────────────────┐      │
│  │                    Node Runtime                              │      │
│  │  ┌──────────┐ ┌───────────┐ ┌────────┐ ┌────────────────┐  │      │
│  │  │  Graph   │ │  Plugin   │ │ State  │ │ Notification  │  │      │
│  │  │  Engine  │ │  Manager  │ │Manager │ │   Gateway      │  │      │
│  │  └────┬─────┘ └─────┬─────┘ └───┬────┘ └───────┬────────┘  │      │
│  │       │              │           │               │            │      │
│  │  ┌────┴─────┐  ┌────┴─────┐ ┌──┴────┐ ┌───────┴────────┐  │      │
│  │  │  ERP     │  │  MCP     │ │Sched- │ │ Sync Engine   │  │      │
│  │  │Connector │  │ Runtime  │ │uler   │ │ (outbound)    │  │      │
│  │  └──────────┘  └──────────┘ └───────┘ └────────────────┘  │      │
│  └────────────────────────────────────────────────────────────┘      │
│                             │ REST (optional)                         │
│  ┌──────────────────────────┴──────────────────────────────────┐      │
│  │        Python AI Runtime (Separate Project — Phase 7)        │      │
│  │  FastAPI │ LangGraph │ Ollama │ OpenAI │ Gemini │ Anthropic  │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                       │
│  ┌───────────────────┐                                                │
│  │   PostgreSQL 16   │                                                │
│  └───────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐         ┌──────────┐
    │ Telegram │        │  WHOTIF  │         │  Email   │
    │   Bot    │        │  Server  │         │  Server  │
    └──────────┘        └──────────┘         └──────────┘
```

---

## 10. Data Flow — Agent Execution Lifecycle

```
1. DEVICE REGISTRATION
   User pastes activation token → POST /api/device/activate
     → Server returns deviceToken (dev_live_xxx) + tenantId
     → Stored in electron-store

2. AGENT PUBLISH (WEHA Cloud)
   Agent Builder → Validate → Sign → Publish to Cloud

3. AGENT SYNC (AI Box → Cloud)
   Sync Engine (outbound HTTPS, Authorization: Bearer <deviceToken>, X-Tenant-ID)
     → Pull new agents → Validate checksum/signature → Store in PostgreSQL

4. AGENT EXECUTION (AI Box)
   Trigger (Schedule / Manual)
     → Graph Engine loads agent definition
     → Validate DAG
     → Create execution record (status: PENDING)
     → Topological sort nodes
     → Execute nodes in order:
         Core → Utility → Business → MCP → Communication (AI nodes stubs)
     → Business nodes call ERP with deviceToken + tenantId
     → Checkpoint after each node
     → On approval: pause execution → notify user → wait → resume
     → On error: retry/stop/rollback per configuration
     → Complete → Store output → Notify subscribers
     → (Event and webhook triggers planned for Phase 7/8)

5. NOTIFICATION DELIVERY
   Communication Node
     → Notification Gateway
     → Route to channel (WHOTIF / Telegram / Email)
     → User responds (approve/reject)
     → Response Gateway receives callback
     → Resume execution

6. HEARTBEAT & TELEMETRY
   Sync Engine (every N seconds)
     → Collect health metrics
     → Send to WEHA Cloud (with device auth headers)
     → Receive commands (deploy/restart/rollback)
```

---

## 11. Assumptions & Dependencies

| ID | Assumption/Dependency | Impact if False |
|----|-----------------------|-----------------|
| A-01 | WEHA ERP supports device activation flow (`POST /api/device/activate`) | Cannot register AI Box as a device; must build alternative auth |
| A-02 | WEHA ERP exposes stable REST API for CRUD and workflow operations accessed with device token | AI Box ERP Connector cannot function |
| A-03 | WEHA Cloud provides sync endpoint for agent distribution | Agents must be deployed manually via file copy |
| A-04 | PostgreSQL 16+ is available on target platform | Must bundle Docker Compose or migrate to SQLite for standalone installs |
| A-05 | Node.js 20+ is available on target platform | Must bundle Node.js runtime in installer |
| A-06 | WHOTIF server is deployed and reachable | Notifications degrade to Telegram/Email-only |
| A-07 | Agent JSON schema is versioned and backward-compatible | Version migration layer required for older agents |
| A-08 | `weha-boilerplate-device` Electron scaffold is maintained and compatible | May need to update Electron version or electron-builder config |
| A-09 | No .NET dependency required | electron-builder NSIS works without .NET runtime |
| A-10 | Redis / BullMQ are not yet integrated | Queue operations use in-memory storage; no cross-restart persistence for queued items |
| A-11 | No automated test infrastructure exists | Testing is planned for Phase 8; manual verification currently relied upon |

---

## 12. Implementation Status

### 12.1 Completed (Phases 1-6)

| Phase | Modules | Status |
|-------|---------|--------|
| **1 — Foundation** | Fastify server, Prisma schema (15 models), JWT auth, RBAC, Audit logging, Plugin framework, Error handling, Swagger docs | ✅ |
| **2 — Runtime Engine** | Graph engine (DAG parse/validate/execute), 25 node types, Checkpoint service, Scheduler (cron/one-time/recurring), Execution API (pause/resume/cancel/retry/rollback) | ✅ |
| **3 — ERP & MCP** | ERP Connector (device auth + CRUD + workflows + approvals), 5 Business nodes, MCP Runtime (discovery + tool execution + circuit breaker + credential vault), 2 MCP nodes | ✅ |
| **4 — Notifications** | Notification gateway (6 providers: WHOTIF, Telegram, Email, WebSocket, FCM, SMS), Channel router, Approval response handling, 5 Communication nodes | ✅ |
| **5 — Desktop** | Electron 33 shell, Clock dashboard, Device settings (7 sections), App settings (4 tabs), Agent/Execution/Scheduler pages, Execution detail with flow viz, Login/Register pages, Collapsible sidebar | ✅ |
| **6 — Sync & Remote** | Sync engine (heartbeat 30s, agent sync 60s), License validation (hourly), Remote commands (deploy/rollback/restart/logs), Command handler | ✅ |

### 12.2 Node Type Inventory

| Category | Implemented | Planned (Phase 7) | Total |
|----------|-------------|-------------------|-------|
| **Core** | start, end, condition, switch, loop, parallel, delay, wait (8) | — | 8 |
| **Utility** | variable, transform, math, json, date (5) | — | 5 |
| **Business** | erp-query, erp-action, workflow-action, approval, task (5) | — | 5 |
| **MCP** | mcp-tool, mcp-workflow (2) | — | 2 |
| **Communication** | whotif, telegram, email, webhook, push (5) | — | 5 |
| **Knowledge** | — | file, database, http, ftp, custom-api (5) | 5 |
| **AI** | prompt (1, stub returning placeholder) | reasoning, summary, classification, recommendation, forecast, vision, ocr, speech (8) | 9 |
| **Total** | **25** (+ 1 stub) | **13** | **39** |

### 12.3 API Endpoints (16 active)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Runtime health check |
| GET | `/api/health/ready` | Readiness probe |
| POST | `/api/auth/login` | Local JWT login |
| POST | `/api/auth/verify` | JWT token verify |
| CRUD | `/api/agents` | Agent list and detail |
| CRUD | `/api/executions` | Create, list, pause, resume, cancel |
| CRUD | `/api/schedules` | Schedule CRUD |
| GET/POST | `/api/erp/*` | ERP status, configure, test |
| CRUD | `/api/mcp/servers` | MCP discover, execute, health |
| POST/GET | `/api/notifications/*` | Send, async, providers, approval-response |
| GET/POST | `/api/sync/*` | Sync status, license, remote commands |
| GET | `/api/license` | License info |
| GET | `/docs` | Swagger UI |

### 12.4 Known Gaps

| Area | Gap | Target Phase |
|------|-----|--------------|
| **AI Runtime** | Python FastAPI + LangGraph service not started; all AI nodes are stubs | Phase 7 |
| **Knowledge nodes** | 5 knowledge node types not implemented | Phase 7 |
| **Event/webhook triggers** | Only manual and scheduled triggers available | Phase 7/8 |
| **ERP data cache** | No local cache layer for offline ERP reads | Phase 7/8 |
| **Redis / BullMQ** | Queues use in-memory storage; no persistence across restarts | Phase 8 |
| **WebSocket push** | No real-time push mechanism active | Phase 8 |
| **AI usage tracking** | AiUsage model exists but no tracking code | Phase 7 |
| **Test infrastructure** | No unit, integration, or E2E tests | Phase 8 |
| **Docker Compose** | No production/dev Docker configuration | Phase 8 |
| **Packaging** | electron-builder configured but E2E-tested installers pending | Phase 8 |
| **Full recovery loop** | Checkpoints exist but no automatic state rebuild on restart | Phase 8 |
| **Plugin cloud sync** | Local plugin manager exists; no sync from WEHA Cloud | Phase 8 |

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **Activation Token** | One-time token generated by ERP admin for device registration |
| **Agent** | A self-contained business process defined as JSON with nodes, edges, variables, and permissions |
| **Agent JSON** | The serialized format of an agent — never executable code |
| **App Settings** | AI Box runtime configuration (General, ERP, MCP, Notifications tabs); accessed from sidebar |
| **Apps Layer** | The AI Box management UI with sidebar navigation (Overview, Agents, Executions, Scheduler, App Settings) |
| **Checkpoint** | A persisted snapshot of execution state after each node transition |
| **DAG** | Directed Acyclic Graph — the execution structure of an agent |
| **Device Layer** | The boilerplate device UI (clock dashboard, registration, device settings); full-screen, no sidebar |
| **Device Settings** | Device lifecycle configuration (Connection, Registration, Auth, Credentials, Device Config, About, Danger Zone); standalone page |
| **Device Token** | Long-lived token (`dev_live_xxx`) issued during activation; used for all ERP API calls |
| **ERP Connector** | Module that communicates with WEHA ERP using device authentication |
| **Execution** | A single run of an agent from trigger to completion |
| **Graph Engine** | The core runtime that parses and executes agent DAGs |
| **MCP** | Model Context Protocol — standard for AI tool discovery and execution |
| **Node** | A single step in an agent graph (e.g., ERP Query, Condition, Telegram Approval) |
| **Node Runtime** | The backend service (Fastify/Node.js) that executes agents |
| **Notification Gateway** | Abstraction layer for multi-channel notification delivery |
| **Plugin** | A self-contained module that extends capability (ERP, MCP, Notification, AI, etc.) |
| **Sync Engine** | Module that manages outbound communication with WEHA Cloud |
| **WHOTIF** | WEHA's primary notification and approval platform |
