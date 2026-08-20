# syntax=docker/dockerfile:1
# ---- Build ----------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (React 19 peers need legacy resolution).
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

# Bake the API base URL into the client bundle at build time.
# ---------------------------------------------------------------------------
# EVERY build argument below defaults to EMPTY, deliberately.
#
# A Dockerfile ARG default applies precisely when the platform does NOT pass
# that argument — so a default is not a safety net, it is a silent substitution.
# NEXT_PUBLIC_CONVEX_URL defaulted to one shared Convex deployment and every
# store built from this image joined the same realtime database; two shops'
# tills showed each other's open baskets. The API base defaulted to another
# shop's host, which would have pointed this till at that shop's products,
# sales and debts with nothing on screen to say so.
#
# Every store is its own deployment, its own database, its own Convex, its own
# Sentry project. Anything that says WHICH store this is therefore has exactly
# one legitimate source: this deployment's environment.
#
# Missing config must FAIL, visibly. It must never fall back to a neighbour.
# ---------------------------------------------------------------------------
ARG NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Which tenant this frontend build serves (public price page scope).
ARG NEXT_PUBLIC_PHARMACY_SLUG=
ENV NEXT_PUBLIC_PHARMACY_SLUG=$NEXT_PUBLIC_PHARMACY_SLUG

ARG NEXT_PUBLIC_SITE_MODE=
ENV NEXT_PUBLIC_SITE_MODE=$NEXT_PUBLIC_SITE_MODE

# Which vertical this build serves. This ARG was missing, and by the note
# below that meant Docker silently dropped it and lib/vertical.ts fell back to
# "shop" — wrong labels everywhere, with no error to notice.
ARG NEXT_PUBLIC_VERTICAL=
ENV NEXT_PUBLIC_VERTICAL=$NEXT_PUBLIC_VERTICAL

ARG NEXT_PUBLIC_ROOT_DOMAIN=
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN

# Convex (realtime cart sync) — public client URL, baked at build time.
#
# DEFAULT EMPTY, on purpose. This used to default to one shared Convex
# deployment, and because a Dockerfile ARG default applies whenever the
# platform does not pass the argument, EVERY store built from this template
# silently joined the same realtime database — while the deploy's build-args
# list showed no Convex variable at all, so it read as "Convex is off".
#
# The cart document there is keyed by the account id alone, and account ids are
# only unique inside ONE store's database: user 2 of one shop and user 2 of
# another shared a document and watched each other's open baskets appear live.
#
# Realtime cart sync is a convenience. Two shops' tills sharing baskets is not
# a convenience. So it stays off unless a deployment explicitly opts in with
# its OWN Convex deployment URL.
ARG NEXT_PUBLIC_CONVEX_URL=
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
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT

ARG NEXT_PUBLIC_CLARITY_ID=
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
ARG SENTRY_ORG=
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_PROJECT=
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
