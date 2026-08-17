"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { Check, HeartHandshake, MessageCircle, Minus, Phone, Plus, ShieldCheck, Store } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Pricing, built to lower the fear of the decision:
 * - Three ready tiers + a "talk to us" card (multi-branch / special needs).
 * - Every price sits next to a reassurance: 60-day money-back, free
 *   migration & training, cancel anytime.
 * - A separate full-width "build your own" calculator: toggle features,
 *   watch the price update live, send the exact configuration to WhatsApp.
 */

const WHATSAPP_BASE = (process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/").replace(/\/$/, "")

const BASE_PRICE = 99
const BASE_LABEL = "الأساس: نقطة بيع + مخزون + ديون + زبائن + عمل بدون إنترنت"

type Addon = { id: string; label: string; price: number }
const ADDONS: Addon[] = [
  { id: "reports", label: "التقارير والتحليلات + المشتريات الذكية", price: 30 },
  { id: "qr", label: "استعلام أسعار QR للزبائن", price: 20 },
  { id: "scan", label: "تحليلات مسح الزبائن (شو بدوروا عليه)", price: 30 },
  { id: "priority", label: "دعم أولوية", price: 20 },
]

const TIERS = [
  {
    name: "أساسي",
    price: 99,
    tag: null,
    who: "لصيدلية بدها تودّع الدفتر والورق",
    features: ["نقطة بيع بالباركود + فواتير", "المخزون والأدوية", "دفتر الديون والزبائن", "بيع بدون إنترنت", "دعم واتساب مباشر"],
  },
  {
    name: "نمو",
    price: 149,
    tag: "الأكثر طلباً",
    who: "الخيار الصح لأغلب الصيدليات",
    features: ["كل شي بالأساسي", "تقارير بتلاقيلك مصاري", "طلبية شراء مقترحة تلقائياً", "استعلام أسعار QR للزبائن", "تصدير كامل لبياناتك"],
  },
  {
    name: "ريادة",
    price: 199,
    tag: null,
    who: "للي بده يعرف كل شي عن صيدليته",
    features: ["كل شي بنمو", "تحليلات مسح الزبائن", "تقارير المبيعات المتقدمة", "دعم أولوية", "شعارك وهويتك بالنظام"],
  },
] as const

const REASSURE = [
  "٦٠ يوم تجربة بضمان استرجاع كامل",
  "نقل بياناتك من نظامك الحالي — علينا",
  "تدريب موظفيك بالمحل — مجاناً",
  "بدون عقود طويلة: غيّر باقتك أو الغِ بأي وقت",
]

function useTweenedNumber(value: number) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obj = { n: prev.current }
    gsap.to(obj, {
      n: value,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(obj.n))
      },
    })
    prev.current = value
  }, [value])
  return ref
}

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={cn("text-sm font-bold", !annual && "text-primary")}>شهري</span>
      <button
        type="button"
        onClick={() => onChange(!annual)}
        aria-label="تبديل الفوترة"
        className={cn("relative h-8 w-14 rounded-full transition-colors", annual ? "bg-primary" : "bg-ink/10")}
      >
        <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-all", annual ? "start-7" : "start-1")} />
      </button>
      <span className={cn("text-sm font-bold", annual && "text-primary")}>
        سنوي <span className="pill pill-success ms-1 text-[10px]">شهرين مجاناً</span>
      </span>
    </div>
  )
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const [on, setOn] = useState<Record<string, boolean>>({ reports: true, qr: true, scan: false, priority: false })
  const [branches, setBranches] = useState(0)

  const monthly = BASE_PRICE + ADDONS.reduce((a, x) => a + (on[x.id] ? x.price : 0), 0) + branches * BASE_PRICE
  const shown = annual ? Math.round((monthly * 10) / 12) : monthly
  const totalRef = useTweenedNumber(shown)
  const tierPrice = (p: number) => (annual ? Math.round((p * 10) / 12) : p)

  const waCustom = () => {
    const feats = [BASE_LABEL, ...ADDONS.filter((a) => on[a.id]).map((a) => a.label)]
    const txt =
      `مرحبا، ركّبت باقتي من موقع فارما:\n- ${feats.join("\n- ")}` +
      (branches > 0 ? `\n- فروع إضافية: ${branches}` : "") +
      `\nالاشتراك: ${annual ? "سنوي" : "شهري"} — تقريباً ${shown} شيكل/شهر.\nشو الخطوة الجاي؟`
    return `${WHATSAPP_BASE}?text=${encodeURIComponent(txt)}`
  }

  return (
    <>
      {/* ── Tiers ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-y border-border/60 bg-card/40">
        <div className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 md:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-bold text-primary">الأسعار</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-[1.2] tracking-tight text-ink md:text-5xl">
              أسعار واضحة. وقرار بدون خوف.
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              أي باقة تختارها، إنت مغطّى: منتقل بياناتك، مندرّب موظفيك بالمحل،
              وعندك ٦٠ يوم كاملة تجرّب — ما ناسبك؟ مصاريك بترجعلك، وبياناتك بتظل إلك.
            </p>
          </div>

          <BillingToggle annual={annual} onChange={setAnnual} />

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={cn(
                  "relative flex flex-col rounded-3xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl",
                  t.tag ? "border-primary shadow-lg shadow-primary/10" : "border-border/60",
                )}
              >
                {t.tag && (
                  <span className="absolute -top-3 start-6 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold text-white">
                    {t.tag}
                  </span>
                )}
                <h3 className="text-lg font-extrabold">{t.name}</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{t.who}</p>
                <div className="mt-4 flex items-baseline gap-1.5" dir="ltr">
                  <span className="text-4xl font-extrabold tracking-tight tabular-nums">{tierPrice(t.price)}</span>
                  <span className="text-sm font-bold text-muted-foreground">₪/شهر</span>
                </div>
                <p className="mt-1 min-h-4 text-[11px] font-semibold text-success">
                  {annual ? `بدل ${t.price} — بتدفع ١٠ شهور بالسنة` : ""}
                </p>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm leading-relaxed">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${WHATSAPP_BASE}?text=${encodeURIComponent(`مرحبا، بدي أبلش بباقة ${t.name} (${annual ? "سنوي" : "شهري"}). شو الخطوة الجاي؟`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold transition",
                    t.tag
                      ? "bg-primary text-white shadow-md hover:brightness-95"
                      : "border border-border bg-background hover:border-primary/40 hover:text-primary",
                  )}
                >
                  ابدأ تجربتك — بدون التزام
                </a>
                <p className="mt-2.5 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-success" />
                  ٦٠ يوم بضمان استرجاع كامل
                </p>
              </div>
            ))}

            {/* Tier 4 — talk to us */}
            <div className="ink-panel relative flex flex-col rounded-3xl p-6">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
                <HeartHandshake className="size-5 text-lime" />
                تواصل معنا
              </h3>
              <p className="mt-1 text-xs font-semibold text-white/60">لمجموعات الفروع والاحتياجات الخاصة</p>
              <div className="mt-4 text-2xl font-extrabold text-lime">عرض على قياسك</div>
              <ul className="mt-4 flex-1 space-y-2.5">
                {[
                  "خصم خاص للفروع المتعددة",
                  "تقارير موحّدة لكل الفروع",
                  "إعداد وتدريب موسّع لكل فريقك",
                  "أولوية بالميزات الجديدة",
                  "شخص واحد مسؤول عنك — مش مركز اتصالات",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm leading-relaxed text-white/85">
                    <Check className="mt-0.5 size-4 shrink-0 text-lime" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`${WHATSAPP_BASE}?text=${encodeURIComponent("مرحبا، عندي أكثر من فرع / احتياج خاص وبدي عرض على قياسي.")}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime text-sm font-extrabold text-lime-foreground shadow-lg shadow-lime/20 transition hover:brightness-95"
              >
                <MessageCircle className="size-4" />
                احكي معنا عالواتساب
              </a>
              <p className="mt-2.5 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-white/50">
                <Phone className="size-3" />
                منرد خلال ساعة بأوقات الدوام
              </p>
            </div>
          </div>

          {/* reassurance strip */}
          <div className="mt-12 grid gap-3 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
            {REASSURE.map((r) => (
              <p key={r} className="flex items-start gap-2 text-[13px] font-semibold leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                {r}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Build-your-own calculator: its own wide section ───────────── */}
      <section id="calculator" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 md:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-sm font-bold text-primary">احسبها بنفسك</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.2] tracking-tight text-ink md:text-5xl">
            ركّب باقتك على كيفك.
          </h2>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted-foreground">
            فعّل بس اللي بتحتاجه — والسعر بيتحدّث قدامك. وإذا احترت،
            ابعتلنا التركيبة وخلينا نحكي فيها سوا، بدون أي التزام.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1.4fr_1fr]">
          {/* feature toggles */}
          <div className="space-y-3 rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm md:p-8">
            <div className="flex items-start gap-3 rounded-2xl bg-primary/5 px-4 py-3.5 text-sm font-semibold leading-relaxed ring-1 ring-primary/15">
              <Check className="mt-0.5 size-4.5 shrink-0 text-primary" />
              <span className="flex-1">{BASE_LABEL}</span>
              <span className="whitespace-nowrap tabular-nums text-muted-foreground" dir="ltr">{BASE_PRICE} ₪</span>
            </div>
            {ADDONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setOn((s) => ({ ...s, [a.id]: !s[a.id] }))}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-start text-sm font-semibold leading-relaxed transition",
                  on[a.id]
                    ? "bg-success/10 ring-1 ring-success/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md transition",
                    on[a.id] ? "bg-success text-white" : "bg-border",
                  )}
                >
                  {on[a.id] && <Check className="size-3.5" />}
                </span>
                <span className="flex-1">{a.label}</span>
                <span className="whitespace-nowrap tabular-nums" dir="ltr">+{a.price} ₪</span>
              </button>
            ))}
            <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3.5 text-sm font-semibold">
              <Store className="size-4.5 shrink-0 text-primary" />
              <span className="flex-1">فروع إضافية <span className="text-xs text-muted-foreground">(٩٩ ₪ للفرع)</span></span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setBranches((b) => Math.max(0, b - 1))}
                  className="grid size-7 place-items-center rounded-full bg-background ring-1 ring-border transition hover:ring-primary/50"
                  aria-label="أقل"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-5 text-center tabular-nums">{branches}</span>
                <button
                  type="button"
                  onClick={() => setBranches((b) => Math.min(9, b + 1))}
                  className="grid size-7 place-items-center rounded-full bg-background ring-1 ring-border transition hover:ring-primary/50"
                  aria-label="أكثر"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* live summary */}
          <div className="ink-panel flex flex-col rounded-[2rem] p-6 md:p-8">
            <BillingToggle annual={annual} onChange={setAnnual} />
            <div className="mt-8 text-center">
              <p className="text-sm font-bold text-white/60">باقتك بتكلف</p>
              <div className="mt-2 flex items-baseline justify-center gap-2 text-lime" dir="ltr">
                <span ref={totalRef} className="text-6xl font-extrabold tabular-nums tracking-tight">
                  {shown}
                </span>
                <span className="text-base font-bold">₪/شهر</span>
              </div>
              <p className="mt-2 min-h-4 text-[12px] font-semibold text-lime/80">
                {annual ? "اشتراك سنوي — بتدفع ١٠ شهور بس" : "بدون عقد — الغِ بأي وقت"}
              </p>
            </div>
            <div className="mt-6 space-y-2 border-t border-white/15 pt-5 text-[12px] font-semibold text-white/70">
              <p className="flex items-center gap-2"><Check className="size-3.5 text-lime" /> نقل بياناتك وتدريب موظفيك — مشمول ببلاش</p>
              <p className="flex items-center gap-2"><Check className="size-3.5 text-lime" /> ٦٠ يوم تجربة بضمان استرجاع كامل</p>
              <p className="flex items-center gap-2"><Check className="size-3.5 text-lime" /> عرض التأسيس: خصم ٥٠٪ أول سنة لأول ٥ صيدليات</p>
            </div>
            <a
              href={waCustom()}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime pt-0.5 text-sm font-extrabold text-lime-foreground shadow-lg shadow-lime/20 transition hover:brightness-95"
            >
              <MessageCircle className="size-4" />
              ابعتلنا التركيبة — ومنرتّبلك كل شي
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
