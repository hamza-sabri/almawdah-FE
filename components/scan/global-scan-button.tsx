"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ScanBarcode } from "lucide-react"

import { ScanDialog } from "@/components/scan/scan-dialog"
import { cn } from "@/lib/utils"

/**
 * What a scan DOES depends on where you are — same button, the job the page
 * is already about:
 *
 *   /inventory  → open that product (the row you'd otherwise have tapped)
 *   everywhere  → the customer-facing price view (/price)
 *
 * On the inventory page a scan means "find me this product", not "search for
 * a string", so it deep-links to the row. Anywhere else a scan is about the
 * price, which is what /price is for.
 */
export function GlobalScanButton({
  variant = "chrome",
  className,
}: {
  variant?: "chrome" | "lime" | "nav"
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const onInventory = pathname?.startsWith("/inventory") ?? false

  const styles = {
    chrome:
      "inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:border-primary/40 hover:text-primary",
    lime: "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-lime px-4 text-sm font-semibold text-lime-foreground shadow-md shadow-lime/30 transition hover:brightness-95",
    nav: "grid size-12 place-items-center rounded-full bg-lime text-lime-foreground shadow-[0_6px_22px_-3px_var(--lime)] transition active:scale-95",
  } as const

  /**
   * `?open=<barcode>` asks the inventory page to jump straight into that
   * product. It falls back to the plain filtered list when the barcode
   * matches more than one row, and offers to create one when it matches none.
   * (`/products` was renamed to `/inventory` — this used to push the old
   * path and only worked via the compatibility redirect.)
   */
  function handleDetect(code: string) {
    const barcode = encodeURIComponent(code)
    router.push(
      onInventory
        ? `/inventory?q=${barcode}&open=${barcode}`
        : `/inventory?q=${barcode}`,
    )
  }

  // The mobile nav's centre button opens the full-screen scan page — the same
  // flow customers use — EXCEPT on inventory, where a scan means "show me
  // this product" and we keep the quick in-page scanner.
  if (variant === "nav" && !onInventory) {
    return (
      <Link href="/price" aria-label="مسح باركود" className={cn(styles.nav, className)}>
        <ScanBarcode className="size-6" />
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label={onInventory ? "مسح باركود لفتح الصنف" : "مسح باركود"}
        onClick={() => setOpen(true)}
        className={cn(styles[variant], className)}
      >
        <ScanBarcode className={variant === "nav" ? "size-6" : "size-5"} />
        {variant === "lime" && <span>مسح باركود</span>}
      </button>
      <ScanDialog open={open} onOpenChange={setOpen} onDetect={handleDetect} />
    </>
  )
}
