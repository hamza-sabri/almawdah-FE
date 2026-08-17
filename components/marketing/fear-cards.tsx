"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import {
  ArrowLeft,
  ChartPie,
  FileUp,
  Loader2,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Undo2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { wipeTo } from "@/components/marketing/page-transition"

/**
 * The "try what scares you" grid. Each card is a real objection heard
 * door-to-door; clicking gives a quick press acknowledgement, then the ink
 * curtain wipes and the visitor lands inside the guest demo with the matching
 * guided tour running. Clean and fast — no gimmicks between them and the
 * product.
 */

type Fear = {
  id: string
  icon: typeof FileUp
  fear: string
  answer: string
  cta: string
  href: string
}

const FEARS: Fear[] = [
  {
    id: "import",
    icon: FileUp,
    fear: "«بخاف أبدّل نظامي وأخسر بياناتي»",
    answer:
      "ما في نقلة مخيفة: منستورد أصنافك وتاريخ مبيعاتك بدقة الباركود، وبتشوف نسبة التطابق قبل ما يتغيّر أي شي. ونظامك القديم بضل شغال جنبنا.",
    cta: "شوف كيف بننقل بياناتك",
    href: "/import?demo=1&tour=import",
  },
  {
    id: "sale",
    icon: ShoppingBag,
    fear: "«الكاشير الجديد رح يبطّئ موظفيني؟»",
    answer:
      "جرّب بنفسك: امسح، عدّل الكمية، واطبع الفاتورة. مصمَّم ليكون أسرع من أي شي جرّبته — وبالعربي.",
    cta: "اعمل فاتورة كاملة الآن",
    href: "/pos?demo=1&tour=new-sale",
  },
  {
    id: "debt",
    icon: ReceiptText,
    fear: "«ديون الزبائن بتضيع مني»",
    answer:
      "كل دين بينسجّل لحاله مع البيع، وكل دفعة بتنحسب — وكشف حساب جاهز لكل زبون بكبسة. ولا شيكل بضيع بعد اليوم.",
    cta: "جرّب البيع بالدين",
    href: "/pos?demo=1&tour=create-debt",
  },
  {
    id: "reports",
    icon: ChartPie,
    fear: "«شو رح تفيدني التقارير؟»",
    answer:
      "افتح التقارير على بيانات صيدلية حقيقية الشكل وشوف بنفسك: البضاعة الراكدة، الأصناف اللي بتنباع بأقل من التكلفة، وأكثر ساعات البيع.",
    cta: "افتح التقارير الآن",
    href: "/reports?demo=1&tour=reports",
  },
  {
    id: "purchases",
    icon: ShoppingCart,
    fear: "«ولا مرة عرفت شو ناقصني قبل ما يخلص»",
    answer:
      "النظام بقترح عليك طلبية الشراء لحاله: من المخزون المنخفض وسرعة البيع — بالكمية والتكلفة والربح المتوقع.",
    cta: "شوف الطلبية الذكية",
    href: "/purchases?demo=1&tour=purchases",
  },
  {
    id: "returns",
    icon: Undo2,
    fear: "«والإرجاع؟ دايماً بلخبط الحسابات»",
    answer:
      "وضع إرجاع بكبسة واحدة: البضاعة بترجع للرف والمبلغ بينخصم من مبيعاتك — بنفس سهولة البيع.",
    cta: "جرّب عملية إرجاع",
    href: "/pos?demo=1&tour=returns",
  },
]

const AR_NUMS = ["٠١", "٠٢", "٠٣", "٠٤", "٠٥", "٠٦"]

function FearCard({ fear, index }: { fear: Fear; index: number }) {
  const router = useRouter()
  const cardRef = useRef<HTMLButtonElement>(null)
  const [leaving, setLeaving] = useState(false)

  const onClick = () => {
    if (leaving) return
    const card = cardRef.current
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!card || reduce) {
      router.push(fear.href)
      return
    }
    setLeaving(true)
    // Quick press acknowledgement, then the curtain takes over.
    gsap
      .timeline({ onComplete: () => wipeTo(fear.href) })
      .to(card, { scale: 0.975, duration: 0.12, ease: "power2.out" })
      .to(card, { scale: 1, duration: 0.18, ease: "power2.out" })
  }

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      className={cn(
        "fear-card group relative flex h-full w-full flex-col rounded-3xl border border-border/60 bg-card p-6 text-start shadow-sm transition-all duration-300",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
        leaving && "cursor-wait",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="icon-chip">
          <fear.icon className="size-5" />
        </span>
        <span className="text-sm font-extrabold tabular-nums text-muted-foreground/50">
          {AR_NUMS[index] ?? ""}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-bold leading-snug">{fear.fear}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{fear.answer}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary transition-all group-hover:gap-2.5">
        {leaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            جارٍ فتح الجولة…
          </>
        ) : (
          <>
            {fear.cta}
            <ArrowLeft className="size-4" />
          </>
        )}
      </span>
    </button>
  )
}

export function FearCards() {
  const gridRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = gridRef.current
      if (!el) return
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const cards = el.querySelectorAll(".fear-card")
      if (reduce || cards.length === 0) return
      gsap.set(cards, { opacity: 0, y: 44, scale: 0.96 })
      const io = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            gsap.to(cards, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.65,
              stagger: 0.08,
              ease: "back.out(1.4)",
              clearProps: "transform",
            })
            obs.disconnect()
          }
        },
        { threshold: 0.1 },
      )
      io.observe(el)
      return () => io.disconnect()
    },
    { scope: gridRef },
  )

  return (
    <div ref={gridRef} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {FEARS.map((f, i) => (
        <FearCard key={f.id} fear={f} index={i} />
      ))}
    </div>
  )
}
