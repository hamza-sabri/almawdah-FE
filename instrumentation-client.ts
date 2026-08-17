// Sentry — browser. Next.js loads this file automatically on the client.
// Inert when NEXT_PUBLIC_SENTRY_DSN is unset (local dev stays quiet).
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // Keep the free tier healthy: sample traces, don't record every session.
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    // Record a replay only when something actually breaks — that's the one
    // we'd want to watch.
    replaysOnErrorSampleRate: 1.0,
    // A store's data is sensitive: never ship PII, and mask everything in
    // replays (text + inputs + media).
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Noise we can't act on: browser extensions, aborted requests, and the
    // offline-mode failures the app already handles gracefully.
    ignoreErrors: [
      "AbortError",
      "Failed to fetch",
      "NetworkError",
      "Load failed",
      "ResizeObserver loop",
      "تعذر الاتصال بالخادم",
    ],
  })
}

// Required by Next.js for navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
