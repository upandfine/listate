# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps

# better-sqlite3 needs build tools to compile its native binding
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---

FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DB_PATH=/app/data/links.db

# sqlite3-CLI fuer Backup-/Verify-Skripte (scripts/backup-db.sh nutzt
# `.backup`-Befehl und PRAGMA integrity_check). bash, weil scripts/ Bash-
# spezifische Features verwendet (set -euo, [[ ]], etc.).
RUN apk add --no-cache sqlite bash

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Backup-Skripte als nicht-versioniert kopieren — nextjs:nodejs als Owner,
# damit sie ueber denselben User wie die App laufen koennen.
COPY --chown=nextjs:nodejs scripts/backup-db.sh scripts/verify-backup.sh ./scripts/

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

# Healthcheck nutzt /api/health (200 OK + DB-Ping). wget ist im alpine-Image
# vorhanden. --start-period gibt Next 15s zum Hochkommen, danach wird alle
# 30s gechecked. 3 Fehlversuche in Folge -> Container gilt als unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
