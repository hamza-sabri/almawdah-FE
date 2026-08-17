"use client"

import { useState } from "react"
import { Share2, X } from "lucide-react"

import { API_BASE } from "@/api/http"
import { getPharmacySlug } from "@/lib/site"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ShareProduct = {
  name?: string
  price?: string | null
  barcode?: string
}

/**
 * The link a customer sends a relative.
 *
 * Built from the CURRENT ORIGIN and nothing else — deliberately no
 * `?store=` slug. The tenant travels in the hostname, which whoever shares
 * the link cannot forge; a slug in the query string could be edited to point
 * the link at a different store's data.
 */
export function buildShareUrl(barcode: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/price?barcode=${encodeURIComponent(barcode)}`
}

/** Server-rendered QR of the same link, for screen-to-screen handover. */
export function productQrSrc(barcode: string, slug: string): string {
  const q = new URLSearchParams({ store: slug, barcode })
  return `${API_BASE}/api/v1/public/product-qr/?${q.toString()}`
}

function shareText(p: ShareProduct): string {
  const name = (p.name || "").trim()
  return p.price ? `${name} — ${formatMoney(p.price)}` : name
}

/**
 * Share a single product with someone who isn't here.
 *
 * Available to EVERYONE, customers included — unlike the staff-only QR of the
 * whole price page. A shopper scans something, sends it to a relative, and the
 * relative sees the price without logging in, installing anything, or coming
 * to the store.
 */
export function ProductShareButton({
  product,
  className,
}: {
  product: ShareProduct
  className?: string
}) {
  const [qrOpen, setQrOpen] = useState(false)
  const barcode = (product.barcode || "").trim()
  if (!barcode) return null // nothing stable to link to

  async function share() {
    const url = buildShareUrl(barcode, window.location.origin)
    const text = shareText(product)
    // The OS sheet lists WhatsApp, which is the channel that matters here.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: product.name || "", text, url })
        return
      } catch {
        /* dismissed, or unavailable — fall through to the QR */
      }
    }
    setQrOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        aria-label="مشاركة المنتج"
        className={cn(
          "grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur active:scale-90",
          className,
        )}
      >
        <Share2 className="size-5" />
      </button>

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-card p-5 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold">{product.name}</span>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                aria-label="إغلاق"
                className="grid size-8 place-items-center rounded-full bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productQrSrc(barcode, getPharmacySlug())}
              alt="رمز المنتج"
              className="mx-auto aspect-square w-full rounded-2xl bg-white p-2"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              وجّه كاميرا هاتف صاحبك على الرمز ليشوف المنتج والسعر
            </p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${shareText(product)}\n${buildShareUrl(barcode, typeof window !== "undefined" ? window.location.origin : "")}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
            >
              مشاركة عبر واتساب
            </a>
          </div>
        </div>
      )}
    </>
  )
}
