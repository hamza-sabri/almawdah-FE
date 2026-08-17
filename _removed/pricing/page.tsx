import type { Metadata } from "next"

import { Pricing } from "@/components/marketing/pricing"

export const metadata: Metadata = {
  title: "الأسعار — فارما",
  description:
    "باقات فارما بالشيكل: العدّة ₪49، احترافي ₪89، وسلسلة ₪79 للفرع. نقل مجاني لبياناتك، تجربة ٣٠ يوماً، وسعر مؤسِّس ثابت لأوائل الصيدليات.",
}

export default function PricingPage() {
  return <Pricing />
}
