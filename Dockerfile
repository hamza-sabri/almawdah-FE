# syntax=docker/dockerfile:1
# ---- Build ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (React 19 peers need legacy resolution).
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

# Bake the API base URL into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE_URL=https://almawdah-api.clinixa.cloud
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Which tenant this frontend build serves (public price page scope).
ARG NEXT_PUBLIC_PHARMACY_SLUG=almawdah
ENV NEXT_PUBLIC_PHARMACY_SLUG=$NEXT_PUBLIC_PHARMACY_SLUG

ARG NEXT_PUBLIC_SITE_MODE=store
ENV NEXT_PUBLIC_SITE_MODE=$NEXT_PUBLIC_SITE_MODE

# Which vertical this build serves. This ARG was missing, and by the note
# below that meant Docker silently dropped it and lib/vertical.ts fell back to
# "shop" — wrong labels everywhere, with no error to notice.
ARG NEXT_PUBLIC_VERTICAL=supermarket
ENV NEXT_PUBLIC_VERTICAL=$NEXT_PUBLIC_VERTICAL

ARG NEXT_PUBLIC_ROOT_DOMAIN=clinixa.cloud
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN

# Convex (realtime cart sync) — public client URL, baked at build time.
ARG NEXT_PUBLIC_CONVEX_URL=https://majestic-egret-857.convex.cloud
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

# Error monitoring (Sentry) + session recordings (Microsoft Clarity).
# NOTE: every NEXT_PUBLIC_* value is inlined by Next at BUILD time, so it must
# be declared as an ARG here. Setting it only in Dokploy's build args is not
# enough — Docker drops any build arg the Dockerfile never declares, and the
# feature then silently disables itself with no error anywhere.
# Both default to empty on purpose: a tenant without its own id/DSN reports
# nothing, instead of mixing into another store's project.
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT

ARG NEXT_PUBLIC_CLARITY_ID=
ENV NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID

# Source-map upload. Same rule as every ARG above: undeclared build args are
# dropped by Docker, so without these three the build still succeeds and you
# just get minified stack traces in Sentry with nothing to tell you why.
ARG SENTRY_AUTH_TOKEN=
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ARG SENTRY_ORG=broken-dudes
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_PROJECT=almawdah-frontend
ENV SENTRY_PROJECT=$SENTRY_PROJECT

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime (standalone) -------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
