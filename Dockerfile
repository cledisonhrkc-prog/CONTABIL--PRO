# SIGC Contábil Pro — Dockerfile para Railway/Fly.io/Render/qualquer VPS
# Uso: sem limite de request/timeout, ideal para volumes altos de NF-e.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 1) Instala dependências
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# 2) Build da aplicação (Next.js standalone)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Não precisa de DATABASE_URL em build (temos lazy DB)
RUN npm run build

# 3) Runtime enxuto
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Como não usamos "output: standalone" no next.config, copiamos tudo
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
