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
#
# NOTE: every NEXT_PUBLIC_* value is inlined by Next at BUILD time. Dokploy's
# runtime "Environment Settings" box does NOT reach the build — build args are
# a separate field — so a value set only there silently disables the feature
# with no error anywhere. That is exactly what happened here: the DSN and the
# Clarity id were in the runtime box, the build compiled them as empty
# strings, and both Sentry and Clarity were dead while the settings page
# looked perfectly configured.
#
# So these are hardcoded as ARG DEFAULTS, the same way the API base URL and
# the vertical already are. Neither is a secret: a Sentry CLIENT DSN and a
# Clarity project id both ship inside the browser bundle by design — anyone
# can read them with View Source. Baking them in removes the whole class of
# "which Dokploy field was it" failure. A build arg still overrides them.
#
# IMPORTANT: this is the right call for THIS single-customer repo. Do NOT
# copy it back into retail-frontend-template — there the empty default is
# what stops one tenant's sessions landing in another tenant's project.
ARG NEXT_PUBLIC_SENTRY_DSN=https://dbf5828239ef1ef74c483ff697917b49@o4505886940921856.ingest.us.sentry.io/4511927759536128
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT

ARG NEXT_PUBLIC_CLARITY_ID=y3xn6e0oda
ENV NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID

# Source-map upload. Deliberately NOT defaulted like the two above: unlike a
# client DSN this is a real credential that can write to the Sentry org, so it
# must not live in git. It has to come from Dokploy's BUILD ARGS field (the
# runtime Environment box will not reach the build).
#
# Without it the build still succeeds and Sentry still works — you just get
# minified stack traces, and `silent: true` in next.config.mjs means nothing
# warns you. That is a nuisance, not an outage: fix it when convenient.
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
