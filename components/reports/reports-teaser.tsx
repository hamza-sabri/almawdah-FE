"use client"

/**
 * Sales-page teaser for the paid reports module.
 *
 * - Account CAN use reports (owner + module): a compact live preview — the
 *   whole card routes to /reports.
 * - Account can't: REAL (but limited) numbers from /reports/teaser/ shown
 *   crisp, then the rest fades into white under a lock. "Contact us" opens
 *   WhatsApp. The API enforces the real gate; this is the upsell surface.
 */
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ChartPie, Lock, MessageCircle } from "lucide-react"

import { reportsSummary, reportsTeaser } from "@/api/reports"
import { hasModule, useIsOwner, useModules } from "@/lib/modules"
import { formatMoney, formatNumber } from "@/lib/format"

const FAKE_BARS = [34, 58, 41, 72, 55, 89, 63, 95, 70, 82, 60, 91]

const WHATSAPP_URL =
  "https://wa.me/972597968056?text=" +
  encodeURIComponent("مرحباً، أرغب بتفعيل ميزة التقارير والتحليلات 📊")

export function LockedReportsTeaser({
  title = "التقارير والتحليلات المتقدمة",
  compact = false,
}: {
  title?: string
  compact?: boolean
}) {
  // REAL numbers — limited on purpose (backend allows any staff member).
  const { data } = useQuery({
    queryKey: ["reports-teaser"],
    queryFn: reportsTeaser,
    staleTime: 10 * 60_000,
    retry: 1,
  })

  const samples: Array<[string, string]> = [
    ["أصناف بدون سعر", data ? formatNumber(data.zero_price) : "…"],
    ["تُباع بأقل من التكلفة", data ? formatNumber(data.below_cost) : "…"],
    ["مخزون بالسالب", data ? formatNumber(data.negative_stock) : "…"],
    ["الأكثر مبيعاً هذا الشهر", data?.top_product || "…"],
  ]

  return (
    <div className="relative mb-5 overflow-hidden rounded-3xl border bg-card p-6">
      {/* A first row of REAL KPIs stays readable — the hook. */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {samples.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-muted/60 p-3.5">
            <p className="font-heading truncate text-xl font-bold">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* The rest fades into WHITE under the lock. */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none opacity-70"
        >
          <div
            className={
              compact ? "flex h-24 items-end gap-1.5" : "flex h-32 items-end gap-1.5"
            }
          >
            {FAKE_BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-lg bg-primary/45"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {["مخزون راكد", "على وشك النفاد", "تقييم المخزون", "الأقل مبيعاً"].map(
              (label) => (
                <div key={label} className="h-16 rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* White fade + lock + WhatsApp CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-end gap-2.5 bg-gradient-to-t from-white via-white/90 to-white/10 pb-2 text-center dark:from-card dark:via-card/90 dark:to-card/10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-border">
            <Lock className="size-5 text-primary" />
          </span>
          <div>
            <p className="font-heading text-lg font-bold">{title}</p>
            <p className="mx-auto mt-0.5 max-w-md text-sm text-muted-foreground">
              الأصناف الخاسرة، المخزون الراكد، الأكثر والأقل مبيعاً، وتقارير
              قابلة للتنزيل — قم بالترقية لعرض المزيد.
            </p>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <MessageCircle className="size-4" />
            تواصل معنا للترقية
          </a>
        </div>
      </div>
    </div>
  )
}

function LivePreview() {
  const { data } = useQuery({
    queryKey: ["reports-summary", 30],
    queryFn: () => reportsSummary(30),
    staleTime: 60_000,
    retry: 1,
  })
  // Defensive: render nothing until the payload has the expected shape.
  if (!data?.issues || !data?.sales) return null
  const issuesTotal =
    (data.issues.zero_price ?? 0) +
    (data.issues.below_cost ?? 0) +
    (data.issues.negative_stock ?? 0)
  return (
    <Link
      href="/reports"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10">
          <ChartPie className="size-5 text-primary" />
        </span>
        <div>
          <p className="font-heading text-sm font-bold">التقارير والتحليلات</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(issuesTotal)} صنف يحتاج انتباهك · إيراد آخر ٣٠ يوماً{" "}
            {formatMoney(data.sales.revenue ?? "0")}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
        فتح التقارير
        <ArrowLeft className="size-4" />
      </span>
    </Link>
  )
}

export function ReportsTeaser() {
  const { modules } = useModules()
  const isOwner = useIsOwner()
  const unlocked = hasModule(modules, "reports") && isOwner
  return unlocked ? <LivePreview /> : <LockedReportsTeaser compact />
}
