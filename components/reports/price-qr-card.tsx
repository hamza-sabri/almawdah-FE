"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownToLine, Printer, QrCode } from "lucide-react"
import { toast } from "sonner"

import { priceQrUrl } from "@/api/reports"
import { useBranding } from "@/hooks/use-branding"
import { useIsOwner } from "@/lib/modules"
import { getPharmacySlug } from "@/lib/site"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The store's price-page QR (logo in the middle) — preview, download and
 * print. Owner-only; rendered server-side so the logo overlay always matches
 * the tenant's real logo. Used as a card (reports page) and as a dialog
 * (sidebar + mobile top bar).
 */
function useQrActions() {
  const { name } = useBranding()
  const isOwner = useIsOwner()
  const [busy, setBusy] = useState(false)

  const { data: qrUrl, isLoading } = useQuery({
    queryKey: ["price-qr"],
    queryFn: priceQrUrl,
    staleTime: 60 * 60_000,
    retry: 1,
    enabled: isOwner,
  })

  function download() {
    if (!qrUrl) return
    const a = document.createElement("a")
    a.href = qrUrl
    a.download = `qr-${getPharmacySlug() || "store"}-price.png`
    a.click()
  }

  function print() {
    if (!qrUrl) return
    setBusy(true)
    const w = window.open("", "_blank", "width=600,height=700")
    if (!w) {
      setBusy(false)
      toast.error("اسمح بالنوافذ المنبثقة للطباعة")
      return
    }
    w.document.write(`<!doctype html><html dir="rtl"><head><title>QR — ${name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:2rem}
      img{width:320px;height:320px}h1{font-size:1.3rem;margin-bottom:.2rem}
      p{color:#555;margin-top:.4rem}</style></head><body>
      <h1>${name}</h1><p>امسح لمعرفة سعر أي منتج فوراً</p>
      <img src="${qrUrl}" onload="setTimeout(()=>{window.print();window.close()},150)"/>
      </body></html>`)
    w.document.close()
    setBusy(false)
  }

  return { qrUrl, isLoading, busy, download, print, isOwner }
}

function QrActionButtons({
  qrUrl,
  busy,
  download,
  print,
  clay = true,
}: ReturnType<typeof useQrActions> & { clay?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      <button
        type="button"
        onClick={download}
        disabled={!qrUrl}
        className={
          clay
            ? "clay-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
            : "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
        }
      >
        <ArrowDownToLine className="size-4" />
        تنزيل PNG
      </button>
      <button
        type="button"
        onClick={print}
        disabled={!qrUrl || busy}
        className={
          clay
            ? "clay-btn-soft inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            : "inline-flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        }
      >
        <Printer className="size-4" />
        طباعة
      </button>
    </div>
  )
}

/** Clay card version — lives on the reports page. */
export function PriceQrCard() {
  const actions = useQrActions()
  if (!actions.isOwner) return null
  const { qrUrl, isLoading } = actions
  return (
    <div className="clay-card flex flex-col items-center gap-4 p-5 sm:flex-row">
      <div className="clay-well flex size-36 shrink-0 items-center justify-center overflow-hidden p-2">
        {isLoading ? (
          <Skeleton className="size-full rounded-xl" />
        ) : qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="QR صفحة الأسعار" className="size-full object-contain" />
        ) : (
          <QrCode className="size-10 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-start">
        <h3 className="font-heading text-base font-bold">
          QR صفحة استعلام الأسعار
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          اطبعه وعلّقه في الصيدلية أو شاركه مع زبائنك — يفتح صفحة فحص الأسعار
          الخاصة بصيدليتك، وشعارك في المنتصف.
        </p>
        <div className="mt-3">
          <QrActionButtons {...actions} />
        </div>
      </div>
    </div>
  )
}

/** Dialog version — opened from the sidebar / mobile top bar. */
export function PriceQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const actions = useQrActions()
  const { qrUrl, isLoading } = actions
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>QR صفحة استعلام الأسعار</DialogTitle>
          <DialogDescription>
            يفتح صفحة فحص الأسعار الخاصة بصيدليتك — اطبعه أو شاركه مع زبائنك.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-2">
          {isLoading ? (
            <Skeleton className="size-80 rounded-2xl sm:size-96" />
          ) : qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="QR صفحة الأسعار"
              className="size-80 rounded-2xl border object-contain p-2 sm:size-96"
            />
          ) : (
            <QrCode className="size-12 text-muted-foreground" />
          )}
        </div>
        <QrActionButtons {...actions} clay={false} />
      </DialogContent>
    </Dialog>
  )
}
