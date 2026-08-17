"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"
import { ArrowLeft, Banknote, PackageX, TrendingUp } from "lucide-react"

import { CountUp } from "@/components/count-up"

/**
 * Live reports preview.
 * - Charts MOUNT when scrolled into view, so the draw-in animation happens
 *   in front of the visitor (not silently on page load).
 * - Then the area chart keeps breathing: every few seconds the data shifts
 *   slightly and recharts tweens to it — the dashboard feels alive, because
 *   the real one is.
 */

const BASE_DAYS = [
  { day: "السبت", total: 1240 },
  { day: "الأحد", total: 1580 },
  { day: "الاثنين", total: 1145 },
  { day: "الثلاثاء", total: 1740 },
  { day: "الأربعاء", total: 1510 },
  { day: "الخميس", total: 2120 },
  { day: "الجمعة", total: 890 },
]

const SPLIT = [
  { name: "نقدي", value: 82, color: "#5B5CE2" },
  { name: "دين", value: 18, color: "#D8F55A" },
]

const KPIS = [
  { icon: TrendingUp, label: "مبيعات آخر ٣٠ يوم", value: 38400, suffix: " ₪" },
  { icon: PackageX, label: "بضاعة راكدة مكتشفة", value: 2150, suffix: " ₪" },
  { icon: Banknote, label: "ديون مستحقة متتبَّعة", value: 3680, suffix: " ₪" },
]

export function ReportPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [days, setDays] = useState(BASE_DAYS)

  // Mount charts only when visible → the draw-in plays on scroll.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Keep the chart breathing after it draws in.
  useEffect(() => {
    if (!inView) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = setInterval(() => {
      setDays(BASE_DAYS.map((d) => ({ ...d, total: Math.round(d.total * (0.93 + Math.random() * 0.14)) })))
    }, 3200)
    return () => clearInterval(t)
  }, [inView])

  return (
    <div ref={ref} className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-xl shadow-primary/5">
      {/* Faux browser chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-5 py-3">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
        <span className="ms-3 rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground" dir="ltr">
          store.clinixa.cloud/reports
        </span>
        <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          مباشر
        </span>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div>
          <div className="grid grid-cols-3 gap-3">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-2xl border border-border/60 bg-background p-3.5">
                <k.icon className="size-4 text-primary" />
                <div className="mt-2 text-lg font-extrabold tabular-nums" dir="ltr">
                  {inView ? <CountUp value={k.value} suffix={k.suffix} /> : <span>0</span>}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 h-44 w-full" dir="ltr">
            {inView && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lpArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B5CE2" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#5B5CE2" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8a8aa3" }} axisLine={false} tickLine={false} reversed />
                  <Tooltip
                    cursor={{ stroke: "#5B5CE2", strokeOpacity: 0.15 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #ececfd", fontSize: 12 }}
                    formatter={(v) => [`${v} ₪`, "مبيعات"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#5B5CE2"
                    strokeWidth={2.5}
                    fill="url(#lpArea)"
                    animationDuration={1400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-background p-4">
          <p className="text-sm font-bold">نقدي مقابل دين</p>
          <div className="h-40 w-40" dir="ltr">
            {inView && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={SPLIT}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={62}
                    paddingAngle={3}
                    strokeWidth={0}
                    animationDuration={1200}
                  >
                    {SPLIT.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #ececfd", fontSize: 12 }}
                    formatter={(v, n) => [`${v}٪`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            {SPLIT.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                {s.name} {s.value}٪
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-6 py-4 md:px-8">
        <p className="text-sm font-semibold text-muted-foreground">
          هاي مش صورة — هاد النظام نفسه. افتحه وقلّب فيه بنفسك:
        </p>
        <Link
          href="/reports?demo=1&tour=reports"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:brightness-95"
        >
          افتح لوحة التقارير
          <ArrowLeft className="size-4" />
        </Link>
      </div>
    </div>
  )
}
