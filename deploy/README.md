# WEHA AI Box — Headless Debian Deployment

The AI Box runs as two headless systemd services on Debian: the **runtime** (Fastify API, port 4000) and the **web console** (Next.js, port 3000). The web console proxies `/api/runtime/*` to the local runtime, so only port 3000 needs to be reachable.

## Architecture

```
Browser (LAN) ──> :3000 Next.js (weha-web)
                    └─ /api/runtime/* ──> :4000 Fastify (weha-runtime)
                                           └─ PostgreSQL + Redis + outbound ERP/sync
```

## Requirements

- Debian 12+ (headless)
- Node.js 20+
- PostgreSQL 16+
- Redis

## Install

```bash
# 1. Create service user
sudo useradd --system --home /opt/weha-ai-box --shell /usr/sbin/nologin weha

# 2. Install app
sudo mkdir -p /opt/weha-ai-box
sudo rsync -a --exclude node_modules --exclude .next ./ /opt/weha-ai-box/
cd /opt/weha-ai-box
sudo npm ci --omit=dev
sudo npm run build
sudo chown -R weha:weha /opt/weha-ai-box

# 3. Environment
sudo cp .env.example /opt/weha-ai-box/.env
sudo nano /opt/weha-ai-box/.env   # set DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY

# 4. Database
sudo -u postgres createdb weha_ai_box
npx prisma db push --config prisma/prisma.config.ts

# 5. Services
sudo cp deploy/weha-runtime.service deploy/weha-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now weha-runtime weha-web
```

## Usage

- Open `http://<box-ip>:3000` from any device on the network
- First-run: paste the activation token at `/register`, then log in at `/login`

## Docker Compose

An alternative to systemd: `Dockerfile`, `docker-compose.yml` and `.dockerignore` in the repo
root, modeled after weha-admin. Images are published to GHCR by `.github/workflows/docker-publish.yml`:

- `ghcr.io/wehaindo/weha-ai-box:latest` — web console (Next.js, target `runner`)
- `ghcr.io/wehaindo/weha-ai-box-runtime:latest` — runtime (Fastify, target `runtime`)
- `ghcr.io/wehaindo/weha-ai-box-migrate:latest` — migrations/seed (target `migrator`)

The stack keeps PostgreSQL/Redis external — set `DATABASE_URL` (and `REDIS_URL` if used)
to your existing instances. Postgres must be reachable from the container.

### Deploy

1. Create a `.env` next to `docker-compose.yml` (copy the shape from `.env.example`):

   ```bash
   DATABASE_URL="postgresql://user:password@db-host:5432/weha_ai_box"
   JWT_SECRET="<random-string-at-least-16-chars>"
   ENCRYPTION_KEY="<random-32-byte-hex-key>"
   LLM_API_KEY="sk-..."
   NATS_URL="nats://gateway-host:4222"
   NATS_USER="admin"
   NATS_PASS="..."
   PORT=3000
   ```

2. Pull and start (requires the images to be public, or `docker login ghcr.io`):

   ```bash
   docker compose pull
   docker compose up -d
   ```

   Or build directly on the box:

   ```bash
   docker compose build
   docker compose up -d
   ```

   The `migrate` service runs `prisma db push` + seed once, then `runtime` starts, then `web`
   (only the web console is exposed on `PORT`; the runtime stays internal on the compose network).

### Troubleshooting

- **`DATABASE_URL variable is not set`** → the host `.env` is missing or empty.
- **`denied`** → GHCR package is private; make it public or run `docker login ghcr.io`.
- **web shows runtime unreachable** → check `docker compose logs runtime`; the rewrite target is
  `RUNTIME_URL` (defaults to `http://runtime:4000` inside compose, `http://127.0.0.1:4000` locally).

## Useful commands

```bash
sudo systemctl status weha-runtime weha-web
sudo journalctl -u weha-runtime -f
sudo systemctl restart weha-runtime
sudo systemctl restart weha-web
```

## Notes

- The runtime binds to `127.0.0.1:4000` (set `RUNTIME_HOST`/`RUNTIME_PORT` in `.env`); only the web console is exposed.
- Device config (token, tenantId, serverUrl, etc.) is persisted in the database `AppConfig` table.
- Updates: replace the app in `/opt/weha-ai-box`, run `npm run build`, then `sudo systemctl restart weha-runtime weha-web`.
