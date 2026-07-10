# WEHA AI Box V2 — Implementation Plan

## Version 3.0 — July 2026

---

## 0. Current Status (Phases 1-6 Complete)

### Built So Far (Source Files Count: ~80 files)

```
├── electron/                    # Adapted from weha-boilerplate-device
│   ├── main.ts                  # Electron 33, runtime IPC, updater
│   └── preload.ts               # contextBridge, ElectronAPI
├── app/                         # Next.js 15 App Router
│   ├── page.tsx                 # Boot flow (loading → register/dashboard)
│   ├── layout.tsx, globals.css
│   ├── register/                # Device activation
│   ├── login/                   # Local JWT login
│   └── dashboard/               # Protected dashboard
│       ├── layout.tsx           # Sidebar nav
│       ├── page.tsx             # Overview (health, stats)
│       ├── agents/              # Agent management
│       ├── executions/          # Execution monitoring
│       ├── scheduler/           # Schedule management
│       └── settings/            # ERP, MCP, notification settings
├── lib/                         # Utilities
│   ├── device-config.ts         # electron-store wrapper + browser fallback
│   └── utils.ts                 # cn() utility
├── types/                       # electron.d.ts
├── src/                         # Runtime backend
│   ├── main.ts                  # Entry point (DB, nodes, providers, sync)
│   ├── app.ts                   # Fastify server (JWT, CORS, Swagger, 16 routes)
│   ├── config/env.ts            # Zod-validated env config
│   ├── api/
│   │   ├── routes/              # health, auth, executions, schedules, erp, mcp,
│   │   │                        #   notifications, sync
│   │   ├── middleware/          # error handler, JWT auth, RBAC
│   │   └── route-factory.ts     # CRUD route generator
│   ├── modules/
│   │   ├── database/            # Prisma 7 + pg adapter
│   │   ├── audit/               # Immutable audit logger
│   │   ├── plugin-manager/      # Registry, loader, lifecycle
│   │   ├── graph-engine/        # DAG execution engine
│   │   │   ├── agent-parser.ts  # Zod schema + SHA-256 checksum
│   │   │   ├── dag-validator.ts # Cycle detection + topological sort
│   │   │   ├── node-handler.ts  # Pluggable handler interface
│   │   │   ├── graph-executor.ts# Walks DAG, pause/resume/retry/rollback
│   │   │   └── nodes/
│   │   │       ├── core/        # start, end, condition, switch, loop,
│   │   │       │                #   parallel, delay, wait (8)
│   │   │       ├── utility/     # variable, transform, math, json, date (5)
│   │   │       ├── business/    # erp-query, erp-action, workflow-action,
│   │   │       │                #   approval, task (5)
│   │   │       ├── mcp/         # mcp-tool, mcp-workflow (2)
│   │   │       └── communication/# whotif, telegram, email, webhook, push (5)
│   │   ├── state-manager/       # Checkpoint + recovery
│   │   ├── scheduler/           # Cron/one-time/recurring
│   │   ├── erp-connector/       # Device auth, query, action, approval
│   │   ├── mcp-runtime/         # Server discovery, tool execution,
│   │   │                        #   circuit breaker, credential vault (AES-256-GCM)
│   │   ├── notification-gateway/# 5 providers, channel router, queue
│   │   └── sync-engine/         # Heartbeat, agent sync, license, remote commands
│   └── types/index.ts           # Agent JSON, Execution, Plugin, Auth types
├── prisma/                      # 15 models, config, seed
└── docs/                        # BRD + Implementation Plan
```

### API Endpoints (16 routes active)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Runtime health check |
| GET | `/api/health/ready` | Readiness probe |
| POST | `/api/auth/login` | Local JWT login |
| POST | `/api/auth/verify` | JWT token verify |
| CRUD | `/api/executions` | Create, list, pause, resume, cancel |
| CRUD | `/api/schedules` | Schedule CRUD |
| GET/POST | `/api/erp/*` | ERP status, configure, test |
| CRUD | `/api/mcp/servers` | MCP discover, execute, health |
| POST/GET | `/api/notifications/*` | Send, async, providers, approval-response |
| GET/POST | `/api/sync/*` | Sync status, license, remote commands |
| GET | `/api/license` | License info |
| GET | `/docs` | Swagger UI |

### Node Types Registered (25 total)

| Category | Nodes | Count |
|----------|-------|-------|
| Core | start, end, condition, switch, loop, parallel, delay, wait | 8 |
| Utility | variable, transform, math, json, date | 5 |
| Business | erp-query, erp-action, workflow-action, approval, task | 5 |
| MCP | mcp-tool, mcp-workflow | 2 |
| Communication | whotif, telegram, email, webhook, push | 5 |

### Verified on Startup

- 25 node types registered
- 5 notification providers registered
- Fastify server on port 4000
- Prisma 7 + PostgreSQL adapter
- Scheduler polling every 10s
- Sync engine (heartbeat 30s, agent sync 60s)
- License service (validation every 1h)
- Swagger docs at /docs

### Remaining

| Phase | Weeks | Status |
|-------|-------|--------|
| 7 — AI Runtime | 16-18 | ⬜ Python FastAPI + LangGraph |
| 8 — Production | 19-22 | ⬜ Packaging, docs, E2E tests |

---

## 1. Development Principles

- **Clean Architecture**: Domain-driven design with strict layer separation
- **Dependency Injection**: All modules receive dependencies via constructor/parameter injection
- **No mock implementations**: Every module must be functional before considered complete
- **No placeholder code**: No TODO comments, no stub functions, no console.log debugging
- **No placeholder UI**: Every UI element must be functional and connected to real data
- **Test-driven**: Unit tests + integration tests required per module
- **Documentation-first**: API docs generated alongside code
- **Incremental delivery**: Each phase produces a runnable, demonstrable system

---

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Runtime** | Node.js | 22 LTS | Matches WEHA ecosystem |
| **API Framework** | Fastify | 5.x | Schema validation, plugin system, performance |
| **Language** | TypeScript | 5.x | Strict mode; consistency across WEHA |
| **Desktop Shell** | Electron | 33 | From weha-boilerplate-device |
| **Desktop UI** | Next.js (App Router) | 15 | From weha-boilerplate-device |
| **UI Components** | shadcn/ui | Latest | Matches all WEHA frontends |
| **Styling** | Tailwind CSS | 3/4 | From weha-boilerplate-device |
| **Database** | PostgreSQL | 16 | ACID compliance, Prisma support |
| **Cache/Queue** | Redis + BullMQ | 7+ / 5.x | Job processing |
| **ORM** | Prisma | 7 | Matches weha-boilerplate |
| **Package Manager** | npm (single project) | Latest | Simpler, no workspace config needed |
| **Testing** | Vitest | Latest | Matches boilerplate |
| **AI Runtime** | Python + FastAPI (separate project) | 3.12 | LangGraph compatibility |

---

## 3. Project Structure

The project is a **single package** like `weha-boilerplate-device` — not a monorepo. The Electron desktop and Node.js runtime live under the same root.

```
weha-ai-box/
├── package.json                      # Single package (no workspaces)
├── tsconfig.json                     # Next.js TS config
├── tsconfig.electron.json            # Electron main process TS config
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.yml
├── .gitignore
├── .env
├── .env.example
├── .prettierrc
├── vitest.config.ts
│
├── electron/                         # FROM weha-boilerplate-devICE
│   ├── main.ts                       # Electron main process
│   └── preload.ts                    # contextBridge IPC
│
├── app/                              # FROM weha-boilerplate-device (adapted)
│   ├── layout.tsx                    # Root layout (Providers, Toaster)
│   ├── globals.css                   # Tailwind + shadcn CSS variables
│   ├── page.tsx                      # Boot: loading → register | dashboard
│   ├── register/                     # Device activation (from device)
│   ├── login/                        # Local JWT login
│   ├── setup/                        # First-time setup
│   └── (dashboard)/                  # Protected dashboard
│       ├── layout.tsx                # Dashboard shell (sidebar + topbar)
│       ├── page.tsx                  # Overview (CPU, memory, executions)
│       ├── agents/                   # Agent management
│       ├── executions/               # Execution monitoring
│       ├── plugins/                  # Plugin management
│       ├── scheduler/                # Schedule management
│       ├── settings/                 # System settings
│       ├── users/                    # User management
│       ├── roles/                    # RBAC configuration
│       ├── logs/                     # System logs viewer
│       ├── license/                  # License management
│       ├── updates/                  # Software updates
│       └── diagnostics/              # System diagnostics
│
├── components/                       # FROM weha-boilerplate-device (extended)
│   ├── ui/                           # shadcn components
│   ├── shared/                       # Reusable UI patterns
│   ├── layout/                       # Sidebar, nav, topbar
│   ├── register.tsx                  # From device
│   ├── dashboard.tsx                 # From device (adapted)
│   ├── settings.tsx                  # From device
│   ├── apps.tsx                      # From device
│   └── updater-dialog.tsx            # From device
│
├── lib/                              # FROM weha-boilerplate-device (extended)
│   ├── device-config.ts              # electron-store wrapper
│   ├── api-client.ts                 # Local runtime API client
│   ├── utils.ts                      # cn() utility
│   └── ...
│
├── hooks/                            # FROM weha-boilerplate-device (extended)
│   └── ...
│
├── types/                            # FROM weha-boilerplate-device (extended)
│   └── electron.d.ts
│
├── src/                              # BUILD FRESH — Runtime backend
│   ├── main.ts                       # Fastify server entry point
│   ├── app.ts                        # Fastify app setup
│   ├── config/
│   │   └── env.ts                    # Environment config
│   ├── api/
│   │   ├── routes/
│   │   │   ├── health.ts             # Health check endpoints
│   │   │   ├── auth.ts               # Local JWT auth endpoints
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── error-handler.ts      # Global error handler
│   │   │   └── auth.ts               # JWT + RBAC middleware
│   │   └── route-factory.ts          # CRUD route generator
│   ├── modules/
│   │   ├── database/
│   │   │   └── database.service.ts   # Prisma connection manager
│   │   ├── audit/
│   │   │   └── audit.service.ts      # Immutable audit logging
│   │   ├── plugin-manager/
│   │   │   ├── plugin-registry.ts    # Plugin lifecycle
│   │   │   └── plugin-loader.ts      # Plugin discovery
│   │   ├── graph-engine/             # Phase 2
│   │   ├── state-manager/            # Phase 2
│   │   ├── scheduler/                # Phase 2
│   │   ├── erp-connector/            # Phase 3
│   │   ├── mcp-runtime/              # Phase 3
│   │   ├── notification-gateway/     # Phase 4
│   │   └── sync-engine/              # Phase 6
│   └── types/
│       └── index.ts                  # Shared types (Agent JSON, Execution, Plugin, etc.)
│
├── prisma/
│   ├── schema.prisma                 # 15 models
│   ├── prisma.config.ts
│   ├── seed.ts
│   └── migrations/
│
├── public/                           # FROM weha-boilerplate-device
│   └── icon.png / icon.ico / icon.icns
│
├── docker-compose.yml                # Phase 8
├── docker-compose.dev.yml            # Phase 8
├── scripts/                          # Build, deploy helpers
└── docs/
    ├── BRD.md
    └── IMPLEMENTATION-PLAN.md
```

### Key Structural Decisions

| Decision | Rationale |
|----------|-----------|
| **Single package, no workspaces** | Simpler than monorepo; runtime backend is consumed by Electron, not imported as a library. Communication is via REST/WebSocket, not direct imports. |
| **`electron/` at root** | Same as weha-boilerplate-device. Electron main process and preload stay together. |
| **`app/` at root** | Same as weha-boilerplate-device. Next.js App Router pages. |
| **`src/` for runtime backend** | Separate from Next.js code. Fastify server runs independently on port 4000. |
| **`src/types/` instead of `packages/core/`** | Shared types are internal to the runtime. Desktop uses runtime API, not direct type imports. |
| **Python AI runtime as separate project** | Not part of this repo. Optional external dependency, deployed via Docker. |

---

## 4. ERP Authentication — Device Activation Flow

AI Box authenticates with WEHA ERP using the **exact same device activation flow** as `weha-boilerplate-device`.

### 4.1 Registration Flow

```
AI Box User                    AI Box Desktop                  WEHA ERP Server
    │                               │                               │
    │  Paste activation link/token   │                               │
    │──────────────────────────────>│                               │
    │                               │  POST /api/device/activate    │
    │                               │  { token: "<base64url>" }     │
    │                               │──────────────────────────────>│
    │                               │                               │
    │                               │  Response:                    │
    │                               │  { device: { id, name,        │
    │                               │      deviceCode, deviceType,  │
    │                               │      store },                 │
    │                               │    credentials: {             │
    │                               │      deviceToken: "dev_live_",│
    │                               │      tenantId,                │
    │                               │      encodedCredentials,      │
    │                               │      tokenId,                 │
    │                               │      scopes                   │
    │                               │    }                          │
    │                               │<──────────────────────────────│
    │                               │                               │
    │                               │  Store in electron-store:     │
    │                               │  - deviceToken                │
    │                               │  - tenantId                   │
    │                               │  - deviceId                   │
    │                               │  - deviceCode                 │
    │                               │  - scopes                     │
    │                               │                               │
    │  ✓ Device Registered          │                               │
    │<──────────────────────────────│                               │
```

### 4.2 Every ERP Request

| Header | Value | Example |
|--------|-------|---------|
| `Authorization` | `Bearer <deviceToken>` | `Bearer dev_live_a1b2c3d4e5f6...` |
| `X-Tenant-ID` | `<tenantId>` | `tnt_abc123xyz` |

### 4.3 Architecture — Two Auth Domains

```
┌────────────────────────────────────────────────────────────────────┐
│                        AI BOX AUTH DOMAINS                          │
│                                                                     │
│  ┌─────────────────────────────┐   ┌────────────────────────────┐  │
│  │  EXTERNAL: ERP Auth         │   │  INTERNAL: Desktop Auth    │  │
│  │  (Device Activation Flow)   │   │  (Local JWT)              │  │
│  │                             │   │                            │  │
│  │  Token: dev_live_xxx        │   │  Token: local JWT         │  │
│  │  Header: Authorization Bear │   │  Issued by: Node Runtime  │  │
│  │  Header: X-Tenant-ID        │   │  Roles: Admin/Oper/Viewer │  │
│  │  Stored in: electron-store  │   │  Scope: Desktop UI only   │  │
│  │  Used by: ERP Connector     │   │                            │  │
│  │  (Node Runtime)             │   │  Used by: Desktop API     │  │
│  │                             │   │  (REST calls to Runtime)  │  │
│  └─────────────────────────────┘   └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 4.4 Device Type Registration

During activation, the AI Box registers as device type `AI_BOX`:
- Same flow as device boilerplate's `POST /api/device/activate`
- Device type is set to `AI_BOX` to distinguish from POS/KDS/KIOSK devices
- Scopes include agent execution permissions (`agent:execute`, `agent:manage`)

---

## 5. Phased Development Plan

---

### Phase 1: Foundation (Weeks 1-2) ✅ COMPLETED

**Goal:** Working project with database, core types, runtime server

#### Week 1 — Project Scaffolding

| Day | Tasks |
|-----|-------|
| 1 | Clone `weha-boilerplate-device` → copy `electron/`, `app/`, `components/`, `lib/`, `hooks/`, `types/` to root |
| 2 | Update `package.json`: appId, productName, add runtime dependencies (fastify, prisma, jwt, etc.) |
| 3 | Create `src/` directory: `main.ts`, `app.ts`, `config/env.ts` |
| 4 | Create `prisma/schema.prisma` with all core models, `prisma.config.ts` |
| 5 | Create `src/modules/database/database.service.ts` + health check API routes |

**Deliverables:**
- Flat project structure (device boilerplate at root + `src/` for runtime)
- Fastify server starts on port 4000 with health endpoint
- Prisma schema generated with 15 models
- Database connection service with health check

#### Week 2 — API Infrastructure + Plugin Framework

| Day | Tasks |
|-----|-------|
| 1 | Local JWT auth module + auth routes (`POST /api/auth/login`) |
| 2 | Error handling middleware + RBAC middleware |
| 3 | API route factory (consistent CRUD patterns) |
| 4 | Audit logging service + audit API |
| 5 | Plugin framework (registry, loader, health check) |

**Deliverables:**
- Full API infrastructure: auth, error handling, RBAC, audit
- Plugin system: discover, register, activate, deactivate
- Swagger docs at `/docs`

**Test pass:** `npm test` passes; runtime starts, health returns OK, login returns JWT

---

### Phase 2: Runtime Engine (Weeks 3-6) ✅ COMPLETED

**Goal:** Graph execution engine that can parse and execute agents deterministically

#### Week 3 — Graph Engine Core

| Day | Tasks |
|-----|-------|
| 1 | Agent JSON parser with schema validation, checksum verification |
| 2 | DAG validator (cycle detection, orphan nodes, connection integrity) |
| 3 | Topological sorter (Kahn's algorithm) |
| 4 | Node registry (map node types to handlers) |
| 5 | Basic graph executor (linear execution, sequential nodes) |

#### Week 4 — Core Nodes

| Day | Tasks |
|-----|-------|
| 1 | StartNode, EndNode (entry/exit points, input/output binding) |
| 2 | ConditionNode (if/else logic with expression evaluation) |
| 3 | SwitchNode (multi-branch routing) |
| 4 | LoopNode (iteration with break conditions) |
| 5 | ParallelNode (fork/join, concurrent branch execution) |

#### Week 5 — Utility Nodes + State Management

| Day | Tasks |
|-----|-------|
| 1 | VariableNode (set, get, delete variables) |
| 2 | TransformNode (JSONata/JSONPath transformations) |
| 3 | MathNode, DateNode, JsonNode |
| 4 | DelayNode, WaitNode (timed pauses, event waits) |
| 5 | Checkpoint service (persist state after every node transition) |

#### Week 6 — Scheduler + Recovery

| Day | Tasks |
|-----|-------|
| 1 | Scheduler service (cron parsing, job scheduling) |
| 2 | Trigger types (cron, one-time, recurring, event, webhook) |
| 3 | BullMQ integration for scheduled executions |
| 4 | Recovery service (rebuild in-memory state from DB on restart) |
| 5 | Execution management API (list, detail, pause, resume, cancel, retry, rollback) |

---

### Phase 3: ERP & MCP Integration (Weeks 5-7) ✅ COMPLETED

**Goal:** Connect to live WEHA ERP using device activation flow and execute MCP tools

#### Week 7 — ERP Connector

| Day | Tasks |
|-----|-------|
| 1 | ERP authentication using device token (`Authorization: Bearer <deviceToken>` + `X-Tenant-ID`) |
| 2 | Device activation token storage and management |
| 3 | ERP query executor (GET endpoints with filtering/pagination) |
| 4 | ERP action executor (POST/PUT/DELETE for CRUD) |
| 5 | ERP approval integration (submit, poll, callback) |

#### Week 8 — Business Nodes

| Day | Tasks |
|-----|-------|
| 1 | ErpQueryNode (configure query, map variables to response) |
| 2 | ErpActionNode (configure CRUD action, handle response) |
| 3 | WorkflowActionNode (trigger ERP workflow, wait for completion) |
| 4 | ApprovalNode (create approval request, pause, wait, resume) |
| 5 | TaskNode (create ERP task/assignment) |

#### Week 9 — MCP Runtime

| Day | Tasks |
|-----|-------|
| 1 | MCP server connection management (connect, disconnect, health check) |
| 2 | MCP tool discovery (list available tools, schemas) |
| 3 | MCP tool execution with parameter validation |
| 4 | Circuit breaker pattern (failure threshold, cooldown, recovery) |
| 5 | Credential vault (encrypted storage for MCP secrets) |

---

### Phase 4: Notifications & Communication (Weeks 8-10) ✅ COMPLETED

**Goal:** Multi-channel notification delivery with approval response handling

#### Week 10 — Notification Gateway

| Day | Tasks |
|-----|-------|
| 1 | Notification type definitions (INFO, APPROVAL, TASK, ALERT) |
| 2 | Notification gateway abstraction (channel-agnostic API) |
| 3 | Channel router (per-agent, per-user routing rules) |
| 4 | Notification queue (BullMQ for reliable delivery) |
| 5 | Delivery tracking (sent, delivered, read, failed) |

#### Week 11 — WHOTIF + Telegram Providers

| Day | Tasks |
|-----|-------|
| 1 | WHOTIF REST client (integrate with weha-notification API) |
| 2 | WHOTIF approval flow (send, receive response callback) |
| 3 | Telegram bot setup (webhook polling, message sending) |
| 4 | Telegram interactive buttons (approve/reject, inline keyboards) |
| 5 | Telegram command handling (/status, /approve, /reject) |

#### Week 12 — Additional Providers + Communication Nodes

| Day | Tasks |
|-----|-------|
| 1 | Email provider (SMTP integration, HTML templates) |
| 2 | WebSocket provider (real-time dashboard updates) |
| 3 | Firebase Cloud Messaging provider |
| 4 | SMS provider |
| 5 | Communication nodes (TelegramNode, WhotifNode, EmailNode, WebhookNode, PushNode) |

---

### Phase 5: Electron Desktop (Weeks 11-13) ✅ COMPLETED

**Goal:** Full desktop application for system management

#### Week 13 — Adapt Device Boilerplate

| Day | Tasks |
|-----|-------|
| 1 | Adapt `electron/main.ts`: window title → "WEHA AI Box", min size → 1200x800, add runtime health IPC |
| 2 | Adapt `electron/preload.ts`: extend ElectronAPI with runtime channels |
| 3 | Adapt `electron-builder.yml`: appId → `com.weha.ai-box`, productName → `WEHA AI Box` |
| 4 | Adapt `lib/device-config.ts`: add AI Box fields (`runtimeUrl`, `agentSyncEnabled`, `aiEnabled`) |
| 5 | Adapt `app/page.tsx`: add runtime health check to boot flow |

#### Week 14 — New Dashboard Pages

| Day | Tasks |
|-----|-------|
| 1 | Dashboard overview (CPU, memory, disk gauges, execution counters, health status) |
| 2 | Agents page (list agents, filter, search, detail view, deploy button) |
| 3 | Executions page (list executions, filter by status/agent/date, detail view) |
| 4 | Execution detail (graph visualization, node-by-node logs, variables) |
| 5 | Real-time execution updates via WebSocket |

#### Week 15 — Configuration + Admin Pages

| Day | Tasks |
|-----|-------|
| 1 | Settings page (system config, ERP connection, MCP servers, notification channels) |
| 2 | Scheduler page (list schedules, create/edit cron, manual trigger) |
| 3 | Users & Roles pages |
| 4 | Logs, License, Updates, Diagnostics pages |
| 5 | Plugins page (installed plugins, activate/deactivate, upload new) |

---

### Phase 6: Sync Engine & Remote Management (Weeks 14-15) ✅ COMPLETED

**Goal:** Cloud synchronization and remote administration

#### Week 16 — Sync Engine

| Day | Tasks |
|-----|-------|
| 1 | Sync engine service (outbound HTTPS client, retry, backoff) — uses device auth headers |
| 2 | Heartbeat sender (periodic status report: health, metrics, version) |
| 3 | Agent sync (pull agent definitions from cloud, validate, store) |
| 4 | Configuration sync (bidirectional config synchronization) |
| 5 | License validation (periodic check, grace period management) |

#### Week 17 — Remote Management

| Day | Tasks |
|-----|-------|
| 1 | Remote command handler (receive and execute commands from cloud) |
| 2 | Restart runtime / deploy agent / rollback agent commands |
| 3 | Remote log collection (stream logs to cloud on demand) |
| 4 | All commands audited |

---

### Phase 7: Python AI Runtime (Weeks 16-18)

**Goal:** Optional Python AI Runtime with LangGraph and multi-provider support

> Note: Python AI Runtime is a **separate project** outside this repository. It is deployed as a Docker container and communicates with the Node Runtime via REST.

#### Week 18 — Python Service Foundation

| Day | Tasks |
|-----|-------|
| 1 | FastAPI service skeleton with health check |
| 2 | API contract definition (REST endpoints matching Node Runtime AI Gateway) |
| 3 | AI Gateway in Node Runtime (proxies AI requests to Python) |
| 4 | Conditional startup (Python service starts only when AI features enabled) |
| 5 | Docker image for Python service |

#### Week 19 — LangGraph + AI Nodes

| Day | Tasks |
|-----|-------|
| 1 | LangGraph adapter (convert WEHA agent subgraph to LangGraph) |
| 2 | ReasoningNode (LangGraph-based reasoning with MCP tool access) |
| 3 | SummaryNode, ClassificationNode, RecommendationNode |
| 4 | ForecastNode (time-series forecasting) |
| 5 | Integration tests: Node Runtime ↔ Python Runtime |

#### Week 20 — Vision, OCR + AI Governance

| Day | Tasks |
|-----|-------|
| 1 | VisionNode (image analysis, object detection) |
| 2 | OcrNode (document/image text extraction) |
| 3 | AI governance service (token tracking, credit usage, per-user limits) |
| 4 | AI usage reporting (dashboard integration) |
| 5 | Local LLM (Ollama) + External LLM (OpenAI, Gemini, Anthropic) providers |

---

### Phase 8: Production Hardening (Weeks 19-22)

**Goal:** Production-ready, documented, packaged, and tested

#### Week 21 — Packaging & Installation

| Day | Tasks |
|-----|-------|
| 1 | Docker Compose production configuration (PostgreSQL, Redis, Runtime) |
| 2 | Windows NSIS installer (electron-builder, include Node.js runtime) |
| 3 | Windows native service wrapper |
| 4 | Linux DEB packaging (systemd service) |
| 5 | Linux RPM packaging (systemd service) |

#### Week 22 — Documentation

| Day | Tasks |
|-----|-------|
| 1 | OpenAPI specification (generate from Fastify routes) |
| 2 | Agent JSON specification (full schema documentation) |
| 3 | Plugin development guide |
| 4 | Deployment guide (Windows, Linux, Docker) |
| 5 | Operations guide (monitoring, backup, restore, troubleshooting) |
| 6 | User guide (dashboard walkthrough, common tasks) |

#### Week 23 — Testing & Performance

| Day | Tasks |
|-----|-------|
| 1 | End-to-end test suite (20+ full agent execution scenarios) |
| 2 | Performance benchmark suite (concurrent agents, latency measurement) |
| 3 | Stress test (100 concurrent agents, 1000 nodes each) |
| 4 | Recovery test (kill at every node, verify checkpoint recovery) |
| 5 | Security penetration test (auth bypass, injection, secret exposure) |

#### Week 24 — Backups, Restore & Polish

| Day | Tasks |
|-----|-------|
| 1 | Backup system (PostgreSQL dump + config export + device credentials) |
| 2 | Restore procedure (full system restore from backup) |
| 3 | Update mechanism (download, verify, backup, install, rollback) |
| 4 | UI polish (loading states, empty states, error states) |
| 5 | Final integration test: full lifecycle from activation → agent publish → sync → execute → complete |

---

## 6. Milestone Summary

| Phase | Weeks | Status | Key Deliverable |
|-------|-------|--------|-----------------|
| 1 — Foundation | 1-2 | ✅ Complete | Fastify server, Prisma schema, Plugin framework, Auth, Audit |
| 2 — Runtime Engine | 3-4 | ✅ Complete | Graph engine, 25 node types, Checkpoint, Scheduler, Execution API |
| 3 — ERP & MCP | 5-7 | ✅ Complete | ERP Connector (device auth), 5 Business nodes, MCP Runtime, 2 MCP nodes |
| 4 — Notifications | 8-10 | ✅ Complete | Notification gateway, 5 providers, Channel router, Queue, 5 Comm nodes |
| 5 — Electron Desktop | 11-13 | ✅ Complete | Adapted Electron shell, 7 dashboard pages (sidebar nav), Login, Register |
| 6 — Sync & Remote | 14-15 | ✅ Complete | Sync engine (heartbeat/agent sync), License service, Remote commands |
| 7 — AI Runtime | 16-18 | ⬜ | Python FastAPI, LangGraph, Multi-provider, AI Governance |
| 8 — Production | 19-22 | ⬜ | Docker Compose, NSIS/DEB/RPM packaging, E2E tests, Documentation |

**Total estimated: 22 weeks (Phases 1-6 complete, Phases 7-8 remaining)**

---

## 7. Resource Requirements (Remaining)

| Role | Allocation | Phases |
|------|-----------|--------|
| **Python Engineer (AI)** | 1 FTE | Phase 7 |
| **DevOps Engineer** | 1 FTE | Phase 8 |
| **QA Engineer** | 1 FTE | Phase 8 |

---

## 8. Dependencies & Risks

| Dependency | Version | Critical | Fallback |
|-----------|---------|----------|----------|
| PostgreSQL | 16+ | Phase 1 | SQLite with limited functionality |
| Redis | 7+ | Phase 2 | In-memory BullMQ (no persistence) |
| Node.js | 22 LTS | Phase 1 | Bundle in installer |
| WEHA ERP API (device auth) | Latest | Phase 3 | Mock ERP |
| WHOTIF Server | Latest | Phase 4 | Email + Telegram only |
| Ollama | Latest | Phase 7 | External AI only |

| Risk | Probability | Mitigation |
|------|-----------|------------|
| WEHA ERP API changes | Medium | Versioned API contract, integration tests |
| Windows service reliability | Low | Graceful shutdown, event log, watchdog |
| PostgreSQL unavailable | Low | Docker PostgreSQL as default |

---

## 9. Scripts & Package.json

```json
{
  "name": "weha-ai-box",
  "version": "1.0.0",
  "private": true,
  "main": "electron-dist/main.js",
  "scripts": {
    "dev:runtime": "tsx watch src/main.ts",
    "dev:desktop": "concurrently -n next,electron \"next dev --port 3111\" \"wait-on http://localhost:3111 && cross-env NODE_ENV=development electron .\"",
    "dev": "concurrently -n runtime,desktop \"npm run dev:runtime\" \"npm run dev:desktop\"",
    "build:next": "next build",
    "build:electron": "tsc --project tsconfig.electron.json && electron-builder",
    "build": "next build && tsc --project tsconfig.electron.json",
    "dist": "npm run build && npm run build:electron",
    "start": "tsx src/main.ts",
    "test": "vitest run",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "15.3.1",
    "react": "^19",
    "fastify": "^5",
    "@prisma/client": "^7",
    "prisma": "^7",
    "electron-store": "^8",
    "electron-updater": "^6",
    "zod": "^3",
    "pino": "^9",
    "pino-pretty": "^13",
    "bullmq": "^5",
    "ioredis": "^5"
  },
  "devDependencies": {
    "electron": "^33",
    "electron-builder": "^25",
    "typescript": "^5",
    "tsx": "^4",
    "vitest": "^3",
    "@types/node": "^20",
    "@types/react": "^19"
  },
  "build": {
    "appId": "com.weha.ai-box",
    "productName": "WEHA AI Box",
    "directories": { "output": "dist" },
    "files": ["electron-dist/**", ".next/**", "public/**", "package.json"],
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": ["AppImage", "deb", "rpm"] }
  }
}
```

---

## 10. Testing Strategy

### Unit Tests (Vitest)
- Every service/module must have >80% code coverage
- Mock external dependencies (DB, ERP, MCP, notification providers)

### Integration Tests
- API endpoint tests with test database
- Full graph execution scenarios
- Plugin lifecycle tests
- Checkpoint/recovery tests

### End-to-End Tests
- Full agent lifecycle: activate device → deploy → schedule → execute → approve → complete
- Multi-agent concurrent execution
- Crash recovery: kill → restart → verify state

### Performance Tests
- 100 concurrent agents with 50-node graphs
- 24-hour steady-state memory test

---

## 11. Deployment Targets

| Platform | Package | Service | Auto-Update |
|----------|---------|---------|-------------|
| Windows 10/11/Server | NSIS .exe | Windows Service | electron-updater |
| Ubuntu 22.04/24.04 | .deb | systemd | Sync engine |
| RHEL 9 / Rocky 9 | .rpm | systemd | Sync engine |
| Docker | docker-compose | Docker Compose | Watchtower |
| macOS (future) | .dmg | launchd | electron-updater |
