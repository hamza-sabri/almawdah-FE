"use client"

import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  ArrowLeft,
  ChartPie,
  FileUp,
  FlaskConical,
  GraduationCap,
  HandCoins,
  Pencil,
  Pill,
  Plus,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { TOURS } from "@/lib/tour/tours"
import { useTour } from "@/components/tour/tour-provider"

/** Icons referenced by the tour definitions (kept out of the data file so the
 *  data stays plain/serialisable). */
const ICONS: Record<string, LucideIcon> = {
  ShoppingBag,
  Undo2,
  Plus,
  ReceiptText,
  HandCoins,
  ChartPie,
  Pill,
  Pencil,
  Users,
  FileUp,
  ShoppingCart,
}

export default function GuidePage() {
  const { startTour } = useTour()
  const scope = useRef<HTMLDivElement>(null)

  // Cards drop in with a staggered, bouncy entrance.
  useGSAP(
    () => {
      gsap.fromTo(
        ".guide-card",
        { y: 44, opacity: 0, scale: 0.8 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: "back.out(2.6)",
          stagger: 0.08,
          clearProps: "transform,opacity",
        },
      )
    },
    { scope },
  )

  return (
    <div ref={scope} className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="الدليل التفاعلي"
        description="جولات تفاعلية تأخذ بيدك خطوة بخطوة داخل النظام — تعلّم بالتجربة، لا بالقراءة"
      />

      {/* Safe-demo explainer */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-lime">
          <FlaskConical className="size-4.5" />
        </span>
        <div className="leading-relaxed">
          <p className="font-semibold text-foreground">
            كل جولة تعمل في «وضع تجريبي» آمن تماماً.
          </p>
          <p className="text-muted-foreground">
            تتحرّك داخل النظام الحقيقي على بيانات وهمية — لن يُحفَظ أي شيء ولن
            يتأثر أي سجل حقيقي. بمجرد إنهاء الجولة يُمسح كل شيء وتعود بياناتك
            الحقيقية.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOURS.map((tour) => {
          const Icon = ICONS[tour.icon] ?? GraduationCap
          return (
            <button
              key={tour.id}
              type="button"
              onClick={() => startTour(tour.id)}
              className="group guide-card text-start"
            >
              <Card className="card-interactive h-full gap-0 p-4 transition group-active:scale-[0.98]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="bg-brand-soft grid size-11 place-items-center rounded-2xl text-primary">
                    <Icon className="size-5.5" />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary opacity-0 transition group-hover:opacity-100">
                    <Sparkles className="size-3" />
                    ابدأ
                  </span>
                </div>
                <h3 className="font-heading text-base font-bold">{tour.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {tour.subtitle}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  ابدأ الجولة
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                </span>
              </Card>
            </button>
          )
        })}
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <GraduationCap className="size-4" />
        اضغط أي جولة لتبدأ — يمكنك الخروج في أي لحظة بزر «تخطّي» أو مفتاح Esc.
      </p>
    </div>
  )
}
