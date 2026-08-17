"use client"

import { useState } from "react"
import { Download, Loader2, Boxes, ShoppingBag } from "lucide-react"
import { toast } from "sonner"

import { API_BASE } from "@/api/http"
import { getAccessToken } from "@/lib/tokens"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Dataset = "products" | "sales"

const SETS: {
  key: Dataset
  label: string
  hint: string
  icon: typeof Boxes
}[] = [
  {
    key: "products",
    label: "كل المنتجات",
    hint: "الاسم، الباركود، التصنيف، السعر، التكلفة، المخزون",
    icon: Boxes,
  },
  {
    key: "sales",
    label: "كل المبيعات",
    hint: "كل عملية بيع مع تاريخها وإجماليها وعدد أصنافها",
    icon: ShoppingBag,
  },
]

/**
 * Full-data export as xlsx.
 *
 * The download is authenticated, so it can't be a plain <a href> — the request
 * has to carry the Bearer token. Fetch it, then hand the browser a blob URL.
 */
export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [busy, setBusy] = useState<Dataset | null>(null)

  async function download(dataset: Dataset) {
    setBusy(dataset)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/api/v1/export/?dataset=${dataset}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "التصدير متاح لمالك المتجر فقط."
            : `تعذر التصدير (${res.status}).`,
        )
      }
      const rows = res.headers.get("X-Row-Count")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `${dataset}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(rows ? `تم تصدير ${Number(rows).toLocaleString()} سجل` : "تم التصدير")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التصدير.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5 text-primary" />
            تصدير البيانات
          </DialogTitle>
          <DialogDescription>
            ملف Excel كامل — بدون حدود ولا تصفية. مناسب للمحاسب أو للنسخ الاحتياطي.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5">
          {SETS.map(({ key, label, hint, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              disabled={busy !== null}
              onClick={() => void download(key)}
              className="h-auto w-full justify-start gap-3 rounded-xl px-4 py-3.5 text-start"
            >
              <span className="bg-brand-soft grid size-10 shrink-0 place-items-center rounded-xl">
                {busy === key ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Icon className="size-5 text-primary" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {hint}
                </span>
              </span>
            </Button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          التصدير الكامل قد يستغرق لحظات مع كثرة السجلات.
        </p>
      </DialogContent>
    </Dialog>
  )
}
