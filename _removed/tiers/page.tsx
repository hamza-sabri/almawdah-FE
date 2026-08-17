import Link from "next/link"
import type { Metadata } from "next"
import {
  Check,
  FileUp,
  Layers,
  Package,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react"

import { BrandMark } from "@/components/brand"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "الباقات — فارما",
  description: "اختر الوحدات التي تناسب صيدليتك — نقطة البيع، الديون، المخزون، أو النظام الكامل.",
}

/**
 * Public tiers page — لا أسعار هنا عمداً (العروض والخصومات تُناقش مباشرة).
 * Each tier is a bundle of feature modules; the backend can also mix & match
 * any combination per store, which the last card advertises.
 */

const TIERS = [
  {
    name: "نقطة البيع",
    tag: "للبيع اليومي السريع",
    icon: Store,
    highlight: false,
    features: [
      "شاشة بيع بالباركود — قارئ USB أو كاميرا",
      "سلال متعددة متوقفة (بيع أكثر من زبون معاً)",
      "مزامنة لحظية بين الأجهزة",
      "إدارة المخزون والأدوية بالكامل",
      "تقارير المبيعات اليومية والشهرية",
    ],
  },
  {
    name: "الشامل",
    tag: "النظام الكامل",
    icon: Sparkles,
    highlight: true,
    features: [
      "كل ما في الباقتين الأخريين",
      "استعلام الأسعار للزبائن — QR داخل الصيدلية",
      "استيراد بياناتك من حسابات (Hesabate) بخطوات بسيطة",
      "حسابات موظفين بصلاحيات مخصصة لكل حساب",
      "لوحة مؤشرات شاملة للمبيعات والديون",
      "دعم وتحديثات بأولوية",
    ],
  },
  {
    name: "الدفاتر والديون",
    tag: "لإدارة حسابات الزبائن",
    icon: ReceiptText,
    highlight: false,
    features: [
      "سجل زبائن كامل مع أرقام الهواتف",
      "دفتر ديون إلكتروني بدل الدفتر الورقي",
      "تسديد كامل أو جزئي بضغطة واحدة",
      "لوحة مؤشرات للديون المستحقة",
      "بحث فوري باسم الزبون أو رقمه",
    ],
  },
]

const MODULES = [
  { icon: Store, label: "نقطة البيع" },
  { icon: Package, label: "المخزون والمنتجات" },
  { icon: Users, label: "الزبائن" },
  { icon: ReceiptText, label: "الديون والدفاتر" },
  { icon: QrCode, label: "استعلام أسعار للزبائن" },
  { icon: FileUp, label: "استيراد من حسابات" },
]

export default function TiersPage() {
  return (
    <main className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="ink-panel relative overflow-hidden px-4 pb-24 pt-10 text-center">
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-11" />
            <span className="font-heading text-xl font-bold text-white">فارما</span>
          </div>
          <p className="pill inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lime">
            <Layers className="size-3.5" />
            باقات على قياس صيدليتك
          </p>
          <h1 className="font-heading text-3xl font-bold leading-snug text-white md:text-4xl">
            ادفع فقط مقابل ما تستخدمه —{" "}
            <span className="text-lime">وحدات تختارها بنفسك</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
            صيدلية تريد نقطة بيع سريعة، وأخرى تريد دفتر ديون إلكتروني، وثالثة تريد
            النظام كاملاً. فارما مبني من وحدات مستقلة — فعّل ما يلزمك اليوم وأضف
            الباقي متى احتجته.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="relative z-10 mx-auto -mt-14 grid w-full max-w-5xl gap-5 px-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const Icon = tier.icon
          return (
            <div
              key={tier.name}
              className={
                "card-interactive relative flex flex-col rounded-[26px] border bg-card p-6 shadow-sm " +
                (tier.highlight
                  ? "border-primary/40 shadow-xl shadow-primary/15 ring-1 ring-primary/30 md:-mt-4 md:mb-4"
                  : "")
              }
            >
              {tier.highlight && (
                <span className="absolute -top-3 start-6 rounded-full bg-lime px-3 py-1 text-[11px] font-bold text-lime-foreground shadow">
                  الأكثر طلباً
                </span>
              )}
              <div
                className={
                  "mb-4 grid size-12 place-items-center rounded-2xl " +
                  (tier.highlight ? "bg-brand-gradient text-white" : "bg-primary/10 text-primary")
                }
              >
                <Icon className="size-6" />
              </div>
              <h2 className="font-heading text-xl font-bold">{tier.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{tier.tag}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hamza.sabri@freightos.com?subject=سوبر ماركت المودة — طلب عرض تجريبي"
                className="mt-6 block w-full"
              >
                <Button
                  className={
                    "h-11 w-full rounded-full " +
                    (tier.highlight ? "bg-brand-gradient border-0" : "")
                  }
                  variant={tier.highlight ? "default" : "outline"}
                >
                  اطلب عرضاً تجريبياً
                </Button>
              </a>
            </div>
          )
        })}
      </section>

      {/* Mix & match */}
      <section className="mx-auto w-full max-w-5xl px-4 py-14">
        <div className="rounded-[26px] border bg-card p-6 md:p-8">
          <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold">
                ولا واحدة مناسبة تماماً؟ <span className="text-gradient">ركّب باقتك بنفسك</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                كل وحدة تعمل مستقلة — اختر أي مزيج، ولكل موظف صلاحياته الخاصة.
              </p>
            </div>
            <span className="pill inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              بيانات كل صيدلية معزولة تماماً
            </span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {MODULES.map(({ icon: ModIcon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-muted/30 px-2 py-4 text-center"
              >
                <ModIcon className="size-5 text-primary" />
                <span className="text-xs font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="pb-10 text-center text-xs text-muted-foreground">
        فارما — نظام إدارة الصيدليات ·{" "}
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          تسجيل دخول الموظفين
        </Link>
      </footer>
    </main>
  )
}
