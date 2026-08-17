/**
 * Ink marquee strip — the classic award-site touch. Pure CSS animation
 * (keyframes in globals.css), duplicated content for a seamless loop,
 * pauses on hover, static for reduced-motion users.
 */

const ITEMS = [
  "يعمل بدون إنترنت",
  "استعلام أسعار QR للزبائن",
  "تقارير أرباح وبضاعة راكدة",
  "دفتر ديون إلكتروني",
  "نقل بياناتك مجاناً",
  "دعم واتساب مباشر",
  "طلبية شراء ذكية",
  "عربي بالكامل",
]

function Row() {
  return (
    <div className="flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center whitespace-nowrap px-6 text-sm font-bold text-white/85">
          {item}
          <span className="ms-12 text-lime">✦</span>
        </span>
      ))}
    </div>
  )
}

export function Marquee() {
  return (
    <div className="overflow-hidden border-y border-ink/20 bg-ink py-3.5" dir="ltr">
      <div className="lp-marquee flex w-max">
        <Row />
        <Row />
      </div>
    </div>
  )
}
