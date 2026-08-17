// Next.js server-side instrumentation hook — loads the right Sentry config
// for whichever runtime the server is executing in.
import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Reports errors thrown while rendering server components / route handlers.
export const onRequestError = Sentry.captureRequestError
