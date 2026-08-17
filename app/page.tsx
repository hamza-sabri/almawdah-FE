import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Landing2 } from "@/components/marketing/landing2"
import { isCentral } from "@/lib/site"

export const metadata: Metadata = {
  title: "فارما — نظام إدارة الصيدلية العربي",
  description:
    "نقطة بيع بالباركود، مخزون، ديون، تقارير ذكية، واستعلام أسعار للزبائن بالـ QR — يعمل حتى بدون إنترنت، مع نقل مجاني لبياناتك من نظامك الحالي. جرّبه كاملاً بدون تسجيل.",
}

export default function HomePage() {
  if (!isCentral()) redirect("/login")
  return <Landing2 />
}
