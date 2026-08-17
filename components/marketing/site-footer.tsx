import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { BrandLockup } from "@/components/brand"

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-ink text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <BrandLockup subtitle={false} tone="ink" />
          <p className="mt-3 max-w-sm text-sm text-white/55">
            نظام إدارة صيدلية عربي بالكامل — نقطة بيع، مخزون، ديون، واستعلام أسعار
            للزبائن. مبني ليعمل حتى عند انقطاع الإنترنت.
          </p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-bold text-lime-foreground transition hover:brightness-95"
          >
            <MessageCircle className="size-4" />
            احجز عرضاً مباشراً
          </a>
        </div>

        <div>
          <p className="mb-3 font-heading font-bold text-white">المنتج</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/#features" className="transition hover:text-white">المميزات</Link></li>
            <li><Link href="/pricing" className="transition hover:text-white">الأسعار</Link></li>
            <li><Link href="/#demo" className="transition hover:text-white">النسخة التجريبية</Link></li>
            <li><Link href="/tiers" className="transition hover:text-white">الباقات والوحدات</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 font-heading font-bold text-white">ابدأ</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/login" className="transition hover:text-white">تسجيل الدخول</Link></li>
            <li><Link href="/price" className="transition hover:text-white">استعلام سعر منتج</Link></li>
            <li><a href={WHATSAPP} target="_blank" rel="noreferrer" className="transition hover:text-white">تواصل عبر واتساب</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} فارما — نظام إدارة الصيدليات
      </div>
    </footer>
  )
}
