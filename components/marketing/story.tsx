"use client"

import { useRef, type ReactNode } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  Check,
  CloudOff,
  HandCoins,
  Printer,
  QrCode,
  ScanBarcode,
  ShoppingCart,
  Wifi,
} from "lucide-react"

import { ProductShot } from "@/components/marketing/product-shot"
import { ReportPreview } from "@/components/marketing/report-preview"

gsap.registerPlugin(ScrollTrigger)

/**
 * "يوم واحد على فارما" — the homepage story.
 *
 * Instead of listing features, the visitor scrolls through one working day
 * in a store that runs on Pharma: first customer, the debt regular, the
 * price-checking shopper, the internet cut, closing time, and tomorrow's
 * order. A time-rail draws itself down the page as they scroll (the classic
 * award-site scroll-line pattern), each scene slides in from its side, and
 * every scene is the REAL product — snapshots and live charts, not stock art.
 */

type Act = {
  time: string
  title: string
  copy: string
  visual: ReactNode
  wide?: boolean
}

/* Small hand-built scene cards (CSS only — crisp at any size) */

function DebtScene() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">أس</span>
            <div>
              <p className="text-sm font-bold">أبو سمير</p>
              <p className="text-[11px] text-muted-foreground">زبون دائم · ٠٥٩٩-XXX-XXX</p>
            </div>
          </div>
          <span className="pill pill-warning text-[10px]">دين مفتوح</span>
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">فاتورة اليوم</span><span className="font-bold tabular-nums">٤٨.٥٠ ₪</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">الرصيد السابق</span><span className="font-bold tabular-nums">١٢٦.٠٠ ₪</span></div>
          <div className="flex justify-between rounded-lg bg-warning/10 px-2 py-1.5"><span className="font-bold">الإجمالي عليه</span><span className="font-extrabold tabular-nums">١٧٤.٥٠ ₪</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-xs font-bold text-success">
        <HandCoins className="size-4" />
        انحفظ الدين مع الفاتورة نفسها — بدون دفتر، بدون نسيان.
      </div>
    </div>
  )
}

function OfflineScene() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-destructive/10">
            <CloudOff className="size-4.5 text-destructive" />
          </span>
          <div>
            <p className="text-sm font-extrabold">انقطع الإنترنت — ٤:٢٠ العصر</p>
            <p className="text-[11px] text-muted-foreground">وضع أوفلاين تلقائي</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs font-semibold">
          {["فاتورة #١٠٤٨ — ٣٢.٠٠ ₪", "فاتورة #١٠٤٩ — ١٥.٥٠ ₪", "فاتورة #١٠٥٠ — ٦٧.٢٥ ₪"].map((f) => (
            <div key={f} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
              <span className="tabular-nums">{f}</span>
              <span className="pill pill-neutral text-[9px]">بانتظار المزامنة</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-xs font-bold text-success">
        <Wifi className="size-4" />
        رجع النت ٥:٥٠ — ٧ فواتير تزامنت لحالها. ولا وحدة ضاعت.
      </div>
    </div>
  )
}

function PurchaseScene() {
  const rows = [
    { name: "بنادول إكسترا ٢٤ قرص", qty: "٤٠", note: "بخلص خلال ٥ أيام" },
    { name: "إنو فوّار للمعدة", qty: "٣٠", note: "نافذ من امبارح" },
    { name: "فكس شراب للسعال", qty: "٢٠", note: "موسم برد" },
  ]
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-primary/10">
              <ShoppingCart className="size-4.5 text-primary" />
            </span>
            <p className="text-sm font-extrabold">طلبية مقترحة — جاهزة</p>
          </div>
          <span className="pill pill-primary text-[10px]">تلقائي</span>
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
              <div>
                <p className="font-bold">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.note}</p>
              </div>
              <span className="font-extrabold tabular-nums text-primary">×{r.qty}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-lime/40 px-3.5 py-2.5 text-xs font-bold text-ink">
          <Printer className="size-4" />
          اطبعها وخذها للمورّد — محسوبة من سرعة بيعك الفعلية.
        </div>
      </div>
    </div>
  )
}

function PhoneFrame({ src, height = 620 }: { src: string; height?: number }) {
  return (
    <div className="mx-auto w-[230px] overflow-hidden rounded-[2rem] border-[6px] border-ink bg-ink shadow-2xl">
      <ProductShot src={src} width={390} height={height} rounded="rounded-[1.6rem]" />
    </div>
  )
}

const ACTS: Act[] = [
  {
    time: "٨:١٥ الصبح",
    title: "أول زبون — فاتورة بـ ١٢ ثانية",
    copy:
      "امسح الباركود، عدّل الكمية بسهم واحد، اضغط Enter — طبعت الفاتورة. موظفك الجديد بتعلمها من أول صبحية، ومن الموبايل أو الكمبيوتر، سيان.",
    visual: <PhoneFrame src="/snap-pos-mobile.html" />,
  },
  {
    time: "١١:٣٠ الصبح",
    title: "أبو سمير — «سجّلها عليّ»",
    copy:
      "بيع بالدين بنفس الفاتورة: بتختار اسمه وخلص. الرصيد بينحدّث لحاله، وكشف حسابه الكامل بكبسة — ولا شيكل بضيع بين الدفاتر بعد اليوم.",
    visual: <DebtScene />,
  },
  {
    time: "١:٠٠ الظهر",
    title: "زبونة بتسأل عن كريم — بس الصيدلي مشغول",
    copy:
      "بتمسح كود QR عن الكاونتر بموبايلها، وبتمسح المنتج: السعر والصور والتوفر قدامها فوراً. وإنت بتعرف بعدين شو الزبائن دوّروا عليه — حتى اللي ما اشتروه.",
    visual: <PhoneFrame src="/snap-price.html" />,
  },
  {
    time: "٤:٢٠ العصر",
    title: "قطع النت. ما حدا لاحظ.",
    copy:
      "الكاشير بكمل بيع عادي بدون إنترنت، والفواتير بتنحفظ محلياً وبتتزامن لحالها لما يرجع الاتصال. الكهربا والنت بفلسطين مش مضمونين — مبيعاتك مضمونة.",
    visual: <OfflineScene />,
  },
  {
    time: "٩:٠٠ المسا",
    title: "سكّرت الصيدلية — افتح أرقامك",
    copy:
      "شو انباع اليوم، قديش نقدي وقديش دين، وشو البضاعة اللي نايمة عالرف وماكلة من رأس مالك. قرارات بكرة بتنبنى على أرقام اليوم — مش على الإحساس.",
    visual: <ReportPreview />,
    wide: true,
  },
  {
    time: "بكرة الصبح",
    title: "الطلبية جاهزة قبل ما تفكر فيها",
    copy:
      "من المخزون المنخفض وسرعة البيع، فارما بجهزلك طلبية الشراء المقترحة: الصنف، الكمية، التكلفة، والربح المتوقع. بتراجعها بدقيقتين وبتطبعها للمورّد.",
    visual: <PurchaseScene />,
  },
]

export function Story() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      if (reduce) return

      // The time-rail draws itself as you scroll through the day.
      gsap.fromTo(
        root.querySelector(".story-line"),
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: "top",
          ease: "none",
          scrollTrigger: { trigger: root, start: "top 55%", end: "bottom 75%", scrub: 0.4 },
        },
      )

      root.querySelectorAll<HTMLElement>(".story-act").forEach((act, i) => {
        const fromStart = i % 2 === 0
        const copy = act.querySelector(".act-copy")
        const visual = act.querySelector(".act-visual")
        const dot = act.querySelector(".act-dot")
        const tl = gsap.timeline({
          scrollTrigger: { trigger: act, start: "top 72%", once: true },
          defaults: { ease: "power3.out" },
        })
        if (dot) tl.from(dot, { scale: 0, duration: 0.35, ease: "back.out(3)" })
        if (copy) tl.from(copy, { x: fromStart ? 70 : -70, opacity: 0, duration: 0.65 }, "-=0.1")
        if (visual)
          tl.from(visual, { x: fromStart ? -60 : 60, y: 30, opacity: 0, rotate: fromStart ? -2 : 2, duration: 0.7, ease: "back.out(1.3)" }, "-=0.4")
      })
    },
    { scope: ref },
  )

  return (
    <section ref={ref} id="story" className="relative overflow-hidden border-b border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-primary">القصة — مش قائمة مميزات</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-[1.2] tracking-tight text-ink md:text-5xl">
            يوم واحد بصيدلية
            <br />
            شغالة على فارما.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            انزل معنا من أول زبون الصبح لحد طلبية بكرة — كل مشهد من النظام
            الحقيقي نفسه.
          </p>
        </div>

        {/* the day, act by act, on a drawing time-rail */}
        <div className="relative mt-20">
          {/* rail */}
          <div className="absolute inset-y-0 start-[13px] hidden w-px md:block">
            <div className="absolute inset-0 bg-border" />
            <div className="story-line absolute inset-0 bg-primary" />
          </div>

          <div className="space-y-24 md:space-y-32">
            {ACTS.map((act, i) => (
              <div key={act.time} className="story-act relative md:ps-16">
                {/* time dot + pill on the rail */}
                <div className="act-dot absolute start-0 top-1 hidden items-center gap-3 md:flex">
                  <span className="grid size-7 place-items-center rounded-full border-2 border-primary bg-background">
                    <span className="size-2.5 rounded-full bg-primary" />
                  </span>
                </div>
                <div
                  className={
                    act.wide
                      ? "space-y-10"
                      : `grid items-center gap-10 md:grid-cols-2 md:gap-16`
                  }
                >
                  <div className={`act-copy max-w-lg ${!act.wide && i % 2 === 1 ? "md:order-2" : ""}`}>
                    <span className="pill pill-primary inline-flex text-xs font-extrabold tabular-nums">{act.time}</span>
                    <h3 className="mt-4 text-2xl font-extrabold leading-snug tracking-tight text-ink md:text-3xl">
                      {act.title}
                    </h3>
                    <p className="mt-4 leading-relaxed text-muted-foreground">{act.copy}</p>
                  </div>
                  <div className={`act-visual ${!act.wide && i % 2 === 1 ? "md:order-1" : ""}`}>{act.visual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* story close */}
        <div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-ink p-6 md:p-8">
          <p className="text-lg font-extrabold text-white md:text-xl">
            هاد مش عرض تقديمي — <span className="text-lime">هاد يومك، بس أخف.</span>
          </p>
          <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
            <Check className="size-4 text-lime" />
            كل المشاهد فوق من النظام الحقيقي
            <span className="mx-1 text-white/30">·</span>
            <ScanBarcode className="size-4 text-lime" />
            جرّبها كلها تحت، بدون تسجيل
            <span className="mx-1 text-white/30">·</span>
            <QrCode className="size-4 text-lime" />
            ولا إشي بينحفظ
          </p>
        </div>
      </div>
    </section>
  )
}
