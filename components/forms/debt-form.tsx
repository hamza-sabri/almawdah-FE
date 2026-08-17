"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  Save,
  ScanBarcode,
  Trash2,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { FormModal } from "@/components/form-modal"
import { ScanDialog } from "@/components/scan/scan-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EntityCombobox, type ComboOption } from "@/components/entity-combobox"
import { CustomerForm } from "@/components/forms/customer-form"
import { productsList } from "@/api/generated/products/products"
import { useCustomersCatalog } from "@/hooks/use-customers-catalog"
import type { Debt } from "@/api/generated/model"
import { ENDPOINTS, upsert } from "@/lib/mutate"
import { formatMoney, toNumber } from "@/lib/format"

type Mode = "items" | "amount"

type Line = {
  key: string
  free: boolean
  medicationId: number | null
  name: string
  unitPrice: string
  quantity: string
}

let lineSeq = 0
function newLine(free: boolean): Line {
  lineSeq += 1
  return {
    key: `l${lineSeq}`,
    free,
    medicationId: null,
    name: "",
    unitPrice: "",
    quantity: "1",
  }
}


/** Tap-first quantity control — no keyboard needed. */
function QtyStepper({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const qty = Math.max(1, Math.trunc(toNumber(value) || 1))
  return (
    <div className="flex h-9 items-center justify-between rounded-xl bg-muted px-1">
      <button
        type="button"
        aria-label="زيادة الكمية"
        onClick={() => onChange(String(qty + 1))}
        className="grid size-7 place-items-center rounded-lg bg-card text-primary shadow-sm transition active:scale-90"
      >
        <Plus className="size-4" />
      </button>
      <span className="min-w-7 text-center text-sm font-bold tabular-nums">
        {qty}
      </span>
      <button
        type="button"
        aria-label="إنقاص الكمية"
        onClick={() => onChange(String(Math.max(1, qty - 1)))}
        disabled={qty <= 1}
        className="grid size-7 place-items-center rounded-lg bg-card text-muted-foreground shadow-sm transition active:scale-90 disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
    </div>
  )
}

const QUICK_AMOUNTS = [5, 10, 20, 50, 100]

const medFetcher = (search: string): Promise<ComboOption[]> =>
  productsList({ search: search || undefined, page_size: 20 }).then((r) =>
    (r.data.results ?? []).map((m): ComboOption => ({
      id: m.id,
      label: m.name ?? "",
      sub: m.category || undefined,
      trailing: formatMoney(m.price),
      price: m.price ?? "0",
    })),
  )

export function DebtForm({
  open,
  onOpenChange,
  debt,
  lockedCustomer,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  debt?: Debt | null
  lockedCustomer?: { id: number; name: string }
}) {
  const qc = useQueryClient()
  const editing = Boolean(debt)
  // Instant local customer search (Redis-cached catalogue).
  const { fetcher: customerFetcher } = useCustomersCatalog()

  const [mode, setMode] = useState<Mode>("items")
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerLabel, setCustomerLabel] = useState("")
  const [custFormOpen, setCustFormOpen] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [amount, setAmount] = useState("")
  const [discounted, setDiscounted] = useState("")
  const [isPaid, setIsPaid] = useState(false)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // Which item line the scanner is currently filling (null = closed).
  const [scanLineKey, setScanLineKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (debt) {
      setMode("items")
      setCustomerId(debt.customer)
      setCustomerLabel(debt.customer_name ?? "")
      setLines(
        (debt.items ?? []).map((it) => {
          lineSeq += 1
          return {
            key: `e${lineSeq}`,
            free: it.product == null,
            medicationId: it.product ?? null,
            name: it.medication_name ?? "",
            unitPrice: it.unit_price ?? "",
            quantity: it.quantity != null ? String(it.quantity) : "1",
          }
        }),
      )
      setDiscounted(debt.discounted_total ?? "")
      setIsPaid(Boolean(debt.is_paid))
      setNote(debt.note ?? "")
      setAmount("")
    } else {
      setMode("items")
      setCustomerId(lockedCustomer?.id ?? null)
      setCustomerLabel(lockedCustomer?.name ?? "")
      setLines([newLine(false)])
      setAmount("")
      setDiscounted("")
      setIsPaid(false)
      setNote("")
    }
  }, [open, debt, lockedCustomer])

  const itemsTotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + toNumber(l.unitPrice) * toNumber(l.quantity),
        0,
      ),
    [lines],
  )
  const total = mode === "amount" ? toNumber(amount) : itemsTotal

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  /** Barcode scanned for a line → look the med up and fill the line. */
  async function handleScan(code: string) {
    const key = scanLineKey
    if (!key) return
    try {
      const r = await productsList({ search: code, page_size: 1 })
      const m = (r.data.results ?? [])[0]
      if (!m) {
        toast.error(`لا يوجد منتج بالباركود ${code}`)
        return
      }
      update(key, {
        medicationId: m.id,
        name: m.name,
        unitPrice: m.price ?? "0",
      })
      toast.success(`تمت إضافة «${m.name}»`)
    } catch {
      toast.error("تعذر البحث عن الباركود")
    }
  }

  async function submit() {
    if (!customerId) {
      toast.error("اختر الزبون أولاً")
      return
    }

    const body: Record<string, unknown> = {
      customer: customerId,
      is_paid: isPaid,
      note: note.trim(),
    }

    if (mode === "amount") {
      if (toNumber(amount) <= 0) {
        toast.error("أدخل مبلغاً صحيحاً")
        return
      }
      body.amount = amount.trim()
      body.items = []
    } else {
      const items = lines
        .filter(
          (l) => (l.medicationId || l.name.trim()) && toNumber(l.quantity) > 0,
        )
        .map((l) => ({
          product: l.medicationId,
          medication_name: l.name.trim() || undefined,
          unit_price: l.unitPrice.trim() || "0",
          quantity: Math.max(1, Math.trunc(toNumber(l.quantity))),
        }))
      if (items.length === 0) {
        toast.error("أضف صنفاً واحداً على الأقل، أو استخدم «مبلغ مباشر»")
        return
      }
      body.items = items
      if (discounted.trim() !== "") body.discounted_total = discounted.trim()
    }

    setSubmitting(true)
    try {
      await upsert(ENDPOINTS.debts, debt?.id, body)
      toast.success(editing ? "تم تحديث الدين" : "تمت إضافة الدين")
      qc.invalidateQueries({ queryKey: ["debts"] })
      qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <FormModal
        open={open}
        onOpenChange={onOpenChange}
        title={editing ? "تعديل دين" : "دين جديد"}
        icon={<ReceiptText className="size-4.5" />}
        footer={
          <>
            <Button
              type="button"
              className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              حفظ
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label>الزبون</Label>
          {lockedCustomer ? (
            <Input value={customerLabel} disabled />
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <EntityCombobox
                  value={customerId}
                  label={customerLabel}
                  onChange={(opt) => {
                    setCustomerId(opt?.id ?? null)
                    setCustomerLabel(opt?.label ?? "")
                  }}
                  fetcher={customerFetcher}
                  placeholder="اختر الزبون"
                  searchPlaceholder="ابحث بالاسم أو الهاتف…"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCustFormOpen(true)}
                aria-label="زبون جديد"
                title="زبون جديد"
              >
                <UserPlus className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="items" className="flex-1">
              من المنتجات
            </TabsTrigger>
            <TabsTrigger value="amount" className="flex-1">
              مبلغ مباشر
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "items" ? (
          <>
            <div className="flex flex-col gap-2">
              <Label>الأصناف</Label>
              {lines.map((line) => {
                const lineTotal =
                  toNumber(line.unitPrice) * toNumber(line.quantity)
                return (
                  <div
                    key={line.key}
                    className="space-y-2 rounded-lg border bg-card/50 p-3"
                  >
                    {line.free ? (
                      <Input
                        placeholder="اسم الصنف"
                        value={line.name}
                        onChange={(e) => update(line.key, { name: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <EntityCombobox
                            value={line.medicationId}
                            label={line.name}
                            onChange={(opt) =>
                              update(line.key, {
                                medicationId: opt?.id ?? null,
                                name: opt?.label ?? "",
                                unitPrice: opt?.price ?? line.unitPrice,
                              })
                            }
                            fetcher={medFetcher}
                            placeholder="اختر منتجً"
                            searchPlaceholder="ابحث عن منتج…"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setScanLineKey(line.key)}
                          aria-label="مسح باركود المنتج"
                          title="مسح باركود المنتج"
                          className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15"
                        >
                          <ScanBarcode className="size-4.5" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">
                          الكمية
                        </Label>
                        <QtyStepper
                          value={line.quantity}
                          onChange={(quantity) => update(line.key, { quantity })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs text-muted-foreground">
                          سعر الوحدة
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          inputMode="decimal"
                          dir="ltr"
                          className="text-start"
                          value={line.unitPrice}
                          onChange={(e) =>
                            update(line.key, { unitPrice: e.target.value })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.key)}
                        aria-label="حذف الصنف"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                      <p className="col-span-3 text-end text-xs text-muted-foreground">
                        المجموع: {formatMoney(lineTotal)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((p) => [...p, newLine(false)])}
                >
                  <Plus className="size-4" />
                  منتج
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((p) => [...p, newLine(true)])}
                >
                  <Plus className="size-4" />
                  صنف حر
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>الإجمالي بعد الخصم (اختياري)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                dir="ltr"
                className="text-start"
                placeholder={`الافتراضي: ${itemsTotal.toFixed(2)}`}
                value={discounted}
                onChange={(e) => setDiscounted(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>المبلغ (₪)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              inputMode="decimal"
              dir="ltr"
              className="h-12 text-start font-heading text-xl font-bold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {/* Tap to build the amount — no keyboard needed. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    setAmount((prev) =>
                      String((toNumber(prev) + a).toFixed(2)),
                    )
                  }
                  className="rounded-full bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 active:scale-95"
                >
                  +{a} ₪
                </button>
              ))}
              {toNumber(amount) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="rounded-full bg-muted px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                >
                  تصفير
                </button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الإجمالي</span>
            <span className="font-heading text-lg font-bold">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: false, label: "غير مدفوع" },
              { value: true, label: "مدفوع" },
            ] as const
          ).map((p) => (
            <button
              key={String(p.value)}
              type="button"
              onClick={() => setIsPaid(p.value)}
              className={
                isPaid === p.value
                  ? p.value
                    ? "rounded-xl bg-success/20 py-2.5 text-sm font-bold text-success-foreground shadow-sm"
                    : "rounded-xl bg-warning/20 py-2.5 text-sm font-bold text-warning-foreground shadow-sm"
                  : "rounded-xl bg-muted py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>ملاحظة</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "amount" ? "سبب الدين (اختياري)" : undefined}
          />
        </div>
      </FormModal>

      <CustomerForm
        open={custFormOpen}
        onOpenChange={setCustFormOpen}
        onSaved={(c) => {
          setCustomerId(c.id)
          setCustomerLabel(c.name)
        }}
      />

      <ScanDialog
        open={scanLineKey != null}
        onOpenChange={(o) => {
          if (!o) setScanLineKey(null)
        }}
        onDetect={handleScan}
        description="امسح باركود العبوة لإضافة المنتج وسعره تلقائياً"
      />
    </>
  )
}
