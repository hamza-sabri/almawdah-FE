"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * Last-resort boundary — the only one that catches a crash in the root layout,
 * the providers, or the login page (which sits outside the (app) group and so
 * has no boundary of its own).
 *
 * Without this file Next renders its own unstyled "Application error: a
 * client-side exception has occurred", in English, with no way back — on a
 * cashier's tablet, mid-shift. It replaces <html>/<body>, so it cannot use the
 * app's providers or Tailwind layer; the styling here is deliberately inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#faf9f7",
          color: "#1c1917",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          حدث خطأ غير متوقع
        </h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.9rem", color: "#57534e" }}>
          أعد المحاولة. إن تكرر الخطأ أغلق التطبيق وافتحه من جديد — المبيعات
          المحفوظة محلياً لن تضيع.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: 0,
            borderRadius: "0.75rem",
            padding: "0.7rem 1.5rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "#fff",
            background: "#16a34a",
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  )
}
