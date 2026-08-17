"use client"

import { Boxes, Images, Layers, Store } from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { usePublicStats } from "@/hooks/use-public-stats"
import { CountUp } from "@/components/count-up"
import { Reveal } from "@/components/marketing/reveal"
import { cn } from "@/lib/utils"

// Indigo → lighter indigo ramp with a lime lead bar.
const BAR_COLORS = ["#5B5CE2", "#6d6ef0", "#8486f4", "#9b9cf7", "#b3b4fa", "#c9caf9", "#dcdcfb", "#ececfd"]

export function StatsSection({
  title = "نظام مبني على بيانات حقيقية",
  subtitle = "أرقام حيّة من صيدليات تعمل على المنصة — تُحدَّث مباشرة من الخادم.",
  className,
}: {
  title?: string
  subtitle?: string
  className?: string
}) {
  const { data, isLoading } = usePublicStats()
  const cats = data?.categories ?? []

  // Empty state: a stats section full of zeros reads as "nobody uses this" —
  // the opposite of social proof. If the public stats aren't available (API
  // down, empty DB, local dev), skip the section entirely.
  if (!isLoading && (!data || !data.products)) return null

  const cards = [
    { icon: Boxes, value: data?.products ?? 0, label: "منتج مُدار عبر المنصة" },
    { icon: Layers, value: data?.listings ?? 0, label: "صنف مُسعّر" },
    { icon: Images, value: data?.with_images ?? 0, label: "صنف بالصور" },
    { icon: Store, value: data?.stores ?? 0, label: "صيدلية على المنصة" },
  ]

  return (
    <section className={cn("mx-auto max-w-6xl px-4 md:px-6", className)}>
      <div className="text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-ink md:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{subtitle}</p>
      </div>

      <Reveal stagger className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-3xl border bg-card p-5 text-center shadow-sm"
          >
            <span className="bg-brand-soft mx-auto mb-3 grid size-11 place-items-center rounded-2xl text-primary">
              <c.icon className="size-5" />
            </span>
            <div className="font-heading text-3xl font-extrabold tracking-tight text-ink">
              {isLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : (
                <CountUp value={c.value} />
              )}
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {c.label}
            </p>
          </div>
        ))}
      </Reveal>

      {cats.length > 0 && (
        <Reveal className="mt-5 rounded-3xl border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-heading text-lg font-bold text-ink">
              التغطية حسب التصنيف
            </p>
            <span className="pill pill-primary px-3 py-1 text-[11px]">
              أعلى {cats.length} تصنيفات
            </span>
          </div>
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cats}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={104}
                  tick={{ fontSize: 12, fill: "#4b4b63" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(91,92,226,0.06)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #ececfd",
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v}`, "منتج"]}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
                  {cats.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      )}
    </section>
  )
}
