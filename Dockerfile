# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/weha_ai_box"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --config=prisma/prisma.config.ts
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json package.json ./
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/weha_ai_box" npx prisma generate --config=prisma/prisma.config.ts
EXPOSE 4000
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/main.ts"]

FROM node:22-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json package.json ./
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/weha_ai_box" npx prisma generate --config=prisma/prisma.config.ts
