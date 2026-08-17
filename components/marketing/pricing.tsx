"use client"

import Link from "next/link"
import {
  Banknote,
  Check,
  Crown,
  Landmark,
  MessageCircle,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SiteNav } from "@/components/marketing/site-nav"
import { SiteFooter } from "@/components/marketing/site-footer"
import { StatsSection } from "@/components/marketing/stats-section"
import { TryDemoButton } from "@/components/marketing/try-demo-button"
import { Reveal } from "@/components/marketing/reveal"

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/"

const TIERS = [
  {
    name: "العدّة",
    en: "Counter",
    tag: "للبيع اليومي السريع",
    price: 50,
    setup: 300,
    highlight: false,
    features: [
      "نقطة بيع بالباركود (كاميرا أو USB)",
      "إدارة المخزون والأدوية بالكامل",
      "استعلام أسعار للزبائن",
      "طباعة إيصالات وملصقات",
    ],
  },
  {
    name: "احترافي",
    en: "Pro",
    tag: "النظام الكامل — الأكثر طلباً",
    price: 100,
    setup: 400,
    highlight: true,
    features: [
      "كل ما في باقة العدّة",
      "عدد غير محدود من المتاجر شهرياً",
      "ديون ودفاتر الزبائن الكاملة",
      "ملفات الزبائن والتاريخ الشرائي",
      "استيراد من حساباتي بضغطة",
      "تقارير ومبيعات وتحليلات",
      "أولوية في الدعم",
      "يعمل بدون إنترنت + مزامنة تلقائية (حصري)",
    ],
  },
  {
    name: "سلسلة",
    en: "Multi-branch",
    tag: "لأكثر من فرع",
    price: 70,
    perBranch: true,
    setup: 500,
    highlight: false,
    features: [
      "باقة احترافي لكل فرع",
      "تقارير موحّدة عبر الفروع (قريباً)",
      "صلاحيات موظفين لكل فرع",
      "إعداد ودعم مخصّص",
    ],
  },
]

const PAYMENTS = [
  { icon: Banknote, label: "نقداً" },
  { icon: Landmark, label: "تحويل بنكي" },
  { icon: Wallet, label: "PalPay" },
  { icon: Smartphone, label: "JawwalPay" },
]

export function Pricing() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />

      <section className="relative overflow-hidden">
        <div className="bg-brand-gradient pointer-events-none absolute -top-40 start-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl" />
        <div className="mx-auto max-w-3xl px-4 pt-16 pb-6 text-center md:px-6 md:pt-20">
          <span className="pill pill-primary inline-flex px-3 py-1 text-xs">
            <Sparkles className="size-3.5" /> أسعار واضحة بالشيكل
          </span>
          <h1 className="mt-4 font-heading text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
            باقات بسيطة، بدون مفاجآت
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            اختر ما يناسب صيدليتك. كل الباقات شهرية، تلغيها متى شئت، مع نقل مجاني
            لبياناتك وتجربة ٣٠ يوماً.
          </p>
        </div>
      </section>

      {/* Founding banner */}
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="ink-panel flex flex-wrap items-center justify-center gap-2 rounded-2xl px-5 py-3 text-center text-sm text-white">
          <Crown className="size-4 text-lime" />
          <span className="font-bold">أول ١٠–١٥ صيدلية:</span>
          <span className="text-white/80">سعر مؤسِّس ثابت مدى الحياة.</span>
        </div>
      </div>

      {/* Tiers */}
      <Reveal
        stagger
        className="mx-auto mt-8 grid max-w-6xl items-stretch gap-5 px-4 md:grid-cols-3 md:px-6"
      >
        {TIERS.map((t) => (
          <div
            key={t.en}
            className={cn(
              "relative flex flex-col rounded-3xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/25",
              t.highlight &&
                "border-primary/40 shadow-xl shadow-primary/15 ring-2 ring-primary/30 md:-mt-5 md:scale-[1.02]",
            )}
          >
            {t.highlight && (
              <span className="bg-lime text-lime-foreground absolute -top-3 start-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold shadow">
                الأكثر شعبية
              </span>
            )}
            <div className="mb-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-xl font-bold text-ink">{t.name}</h3>
                <span className="text-xs text-muted-foreground">{t.en}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.tag}</p>
            </div>

            <div className="mb-1 flex items-end gap-1">
              <span className="font-heading text-5xl font-extrabold tracking-tight text-ink">
                ₪{t.price}
              </span>
              <span className="mb-1.5 text-sm text-muted-foreground">
                / شهرياً{t.perBranch ? " للفرع" : ""}
              </span>
            </div>
            <p className="mb-5 text-xs text-muted-foreground">
              + رسوم إعداد لمرة واحدة ₪{t.setup} (تشمل التركيب والتدريب)
            </p>

            <ul className="mb-6 flex-1 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" />
                  </span>
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {t.highlight ? (
              <TryDemoButton label="جرّب احترافي مجاناً" className="w-full" />
            ) : (
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card font-heading font-bold shadow-sm transition hover:border-primary/40 hover:text-primary"
              >
                <MessageCircle className="size-4" />
                تواصل للاشتراك
              </a>
            )}
          </div>
        ))}
      </Reveal>

      {/* Payments */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="rounded-3xl border bg-card p-6 text-center shadow-sm">
          <p className="font-heading text-lg font-bold text-ink">الدفع سهل ومحلي</p>
          <p className="mt-1 text-sm text-muted-foreground">
            بدون بطاقات أجنبية أو رسوم تحويل معقّدة.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {PAYMENTS.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold"
              >
                <p.icon className="size-4 text-primary" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Data-backed */}
      <StatsSection
        className="py-8 md:py-12"
        title="نظام مبني على كتالوج حقيقي"
        subtitle="استورد كتالوج صيدليتك بالكامل في دقائق — بياناتك تبدأ جاهزة، لا من الصفر."
      />

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-ink md:text-4xl">
            شوف النظام قبل ما تقرّر
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            ادخل النسخة التجريبية كاملة الآن — بدون تسجيل — وجرّب كل شيء بنفسك.
          </p>
          <div className="mt-6 flex justify-center">
            <TryDemoButton />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            عندك أسئلة؟{" "}
            <Link href="/tiers" className="font-semibold text-primary hover:underline">
              تفاصيل الوحدات
            </Link>{" "}
            أو{" "}
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              تواصل عبر واتساب
            </a>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
