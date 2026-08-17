"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ClipboardList,
  CloudOff,
  Download,
  Filter,
  Info,
  Loader2,
  Minus,
  MoreVertical,
  PackageCheck,
  Plus,
  Printer,
  Save,
  ScanBarcode,
  Search,
  ShoppingCart,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react"

import { customFetch } from "@/api/http"
import { restockQuota } from "@/api/reports"
import {
  purchaseOrderCreate,
  purchaseOrderDelete,
  purchaseOrderReceive,
  purchaseOrdersList,
  type PurchaseOrder,
} from "@/api/purchases"
import { hasModule, useIsOwner, useModules } from "@/lib/modules"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { InlineScanner } from "@/components/scan/inline-scanner"
import type { ScanFeedback } from "@/components/scan/scan-dialog"
import { ConfirmDelete } from "@/components/confirm-delete"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const DRAFT_KEY = "pharma_purchase_draft_v1"
const PENDING_KEY = "pharma_purchase_pending_v1"
const FAB_GRADIENT = "linear-gradient(135deg, var(--primary), var(--chart-2))"

type PendingItem = {
  medication_id: number | null
  medication_name: string
  barcode: string
  quantity: string
  unit_cost: string
}
type PendingOrder = {
  clientId: string
  items: PendingItem[]
  createdAt: number
  total: number
  count: number
}

function readPending(): PendingOrder[] {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) || "[]") as PendingOrder[]
  } catch {
    return []
  }
}
function writePending(list: PendingOrder[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
function newId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined
  return c && "randomUUID" in c
    ? c.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type MedLite = {
  id: number
  name: string
  barcode: string | null
  cost: string
  price: string
  stock: string
  category?: string | null
  manufacturer?: string | null
}

type Line = {
  medicationId: number
  name: string
  barcode: string
  company: string
  category: string
  cost: number
  price: number
  stock: number
  qty: number
}

type SortKey = "name" | "barcode" | "stock" | "cost" | "qty" | "total"

async function lookupMeds(
  params: Record<string, string | number>,
): Promise<MedLite[]> {
  const q = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  const res = await customFetch<{ data: { results: MedLite[] } }>(
    `/api/v1/products/?${q}`,
  )
  return res.data.results ?? []
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  )
}

function printRows(
  title: string,
  rows: { name: string; barcode: string; qty: number; cost: number }[],
) {
  const w = window.open("", "_blank", "width=800,height=900")
  if (!w) {
    toast.error("فعّل النوافذ المنبثقة للطباعة")
    return
  }
  const total = rows.reduce((s, r) => s + r.qty * r.cost, 0)
  const body = rows
    .map(
      (r) => `<tr><td>${escapeHtml(r.name)}</td><td style="direction:ltr">${escapeHtml(
        r.barcode,
      )}</td><td>${r.qty}</td><td>${r.cost.toFixed(2)}</td><td>${(
        r.qty * r.cost
      ).toFixed(2)}</td></tr>`,
    )
    .join("")
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}
    .muted{color:#666;font-size:12px;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5}tfoot td{font-weight:bold}</style>
    </head><body><h1>${escapeHtml(title)}</h1><p class="muted">${new Date().toLocaleString(
      "ar",
    )}</p>
    <table><thead><tr><th>الصنف</th><th>الباركود</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead>
    <tbody>${body}</tbody><tfoot><tr><td colspan="4">إجمالي التكلفة</td><td>${total.toFixed(
      2,
    )}</td></tr></tfoot></table></body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsvRows(
  filename: string,
  rows: { name: string; barcode: string; qty: number; cost: number }[],
) {
  const header = ["الصنف", "الباركود", "الكمية", "التكلفة", "الإجمالي"]
  const body = rows.map((r) => [
    r.name,
    r.barcode,
    r.qty,
    r.cost.toFixed(2),
    (r.qty * r.cost).toFixed(2),
  ])
  const csv = [header, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function PurchasesPage() {
  const isOwner = useIsOwner()
  const qc = useQueryClient()

  const [view, setView] = useState<"new" | "history">("new")
  const [lines, setLines] = useState<Line[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [addQuery, setAddQuery] = useState("")
  const [addResults, setAddResults] = useState<MedLite[]>([])

  // Table search + filters
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [fCompany, setFCompany] = useState("")
  const [fCategory, setFCategory] = useState("")
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [costMin, setCostMin] = useState("")
  const [costMax, setCostMax] = useState("")

  // Sort + selection
  const [sortKey, setSortKey] = useState<SortKey>("total")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkAmount, setBulkAmount] = useState("")
  const [visibleCount, setVisibleCount] = useState(80)

  const [scanMode, setScanMode] = useState<"add" | "filter" | null>(null)
  const [generating, setGenerating] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const { modules } = useModules()
  const offlineEnabled =
    modules === null || hasModule(modules, ["offline", "offline_purchases"])
  const [pending, setPending] = useState<PendingOrder[]>([])
  const flushingRef = useRef(false)

  const [genOpen, setGenOpen] = useState(false)
  const [genDays, setGenDays] = useState(30)
  const [genCover, setGenCover] = useState(30)
  const [genThreshold, setGenThreshold] = useState(5)

  // ── Local draft ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY)
      if (raw) setLines(JSON.parse(raw) as Line[])
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (!hydrated) return
    try {
      if (lines.length) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(lines))
      else window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }, [lines, hydrated])

  const dq = useDebounced(addQuery, 250).trim()
  useEffect(() => {
    if (dq.length < 2) {
      setAddResults([])
      return
    }
    let alive = true
    void lookupMeds({ search: dq, page_size: 15 })
      .then((r) => alive && setAddResults(r))
      .catch(() => alive && setAddResults([]))
    return () => {
      alive = false
    }
  }, [dq])

  function addMed(m: MedLite, qty = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.medicationId === m.id)
      if (existing) {
        return prev.map((l) =>
          l.medicationId === m.id ? { ...l, qty: l.qty + qty } : l,
        )
      }
      return [
        ...prev,
        {
          medicationId: m.id,
          name: m.name,
          barcode: m.barcode ?? "",
          company: m.manufacturer ?? "",
          category: m.category ?? "",
          cost: toNumber(m.cost),
          price: toNumber(m.price),
          stock: toNumber(m.stock),
          qty,
        },
      ]
    })
  }
  function setQty(id: number, qty: number) {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.medicationId !== id)
        : prev.map((l) => (l.medicationId === id ? { ...l, qty } : l)),
    )
  }
  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.medicationId !== id))
    setSelected((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  async function resolveCode(code: string): Promise<MedLite | null> {
    let hits = await lookupMeds({ barcode: code, page_size: 1 })
    if (hits.length === 0) hits = await lookupMeds({ search: code, page_size: 1 })
    return hits[0] ?? null
  }

  async function onScan(code: string): Promise<ScanFeedback> {
    const c = code.trim()
    try {
      if (scanMode === "filter") {
        setSearch(c)
        setScanMode(null)
        return { ok: true, message: "تمت التصفية" }
      }
      const m = await resolveCode(c)
      if (!m) return { ok: false, message: "غير موجود في المنتجات" }
      addMed(m)
      return { ok: true, message: m.name }
    } catch {
      return { ok: false, message: "تعذّر البحث" }
    }
  }

  async function generate() {
    setGenerating(true)
    setGenOpen(false)
    try {
      const q = await restockQuota({
        days: genDays,
        cover_days: genCover,
        low_stock_threshold: genThreshold,
      })
      setLines(
        q.results.map((r) => ({
          medicationId: r.medication_id,
          name: r.name,
          barcode: r.barcode,
          company: r.manufacturer ?? "",
          category: r.category ?? "",
          cost: toNumber(r.cost),
          price: toNumber(r.price),
          stock: toNumber(r.stock),
          qty: Math.max(1, Math.round(toNumber(r.suggested_qty))),
        })),
      )
      setSelected(new Set())
      toast.success(
        q.count > 0
          ? `تم اقتراح ${formatNumber(q.count)} صنف للشراء`
          : "لا توجد أصناف تحتاج شراءً الآن",
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر توليد الطلبية")
    } finally {
      setGenerating(false)
    }
  }

  const flushPending = async () => {
    if (flushingRef.current) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) return
    flushingRef.current = true
    try {
      for (const p of readPending()) {
        try {
          await purchaseOrderCreate({ items: p.items })
        } catch {
          break // offline / server error → keep the rest queued, retry later
        }
        const left = readPending().filter((x) => x.clientId !== p.clientId)
        writePending(left)
        setPending(left)
        void qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      }
    } finally {
      flushingRef.current = false
    }
  }

  function removePending(id: string) {
    const left = readPending().filter((x) => x.clientId !== id)
    writePending(left)
    setPending(left)
  }

  function saveOrder() {
    if (lines.length === 0) return
    const offline = typeof navigator !== "undefined" && navigator.onLine === false
    if (offline && !offlineEnabled) {
      toast.error("العمل بدون إنترنت متاح في الباقة الأعلى.")
      return
    }
    // Write-ahead: queue locally FIRST so a save is never lost, then sync.
    const entry: PendingOrder = {
      clientId: newId(),
      items: lines.map((l) => ({
        medication_id: l.medicationId,
        medication_name: l.name,
        barcode: l.barcode,
        quantity: String(l.qty),
        unit_cost: String(l.cost),
      })),
      createdAt: Date.now(),
      total: buyCost,
      count: lines.length,
    }
    const next = [...readPending(), entry]
    writePending(next)
    setPending(next)
    setLines([])
    setSelected(new Set())
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
    setView("history")
    toast.success(
      offline ? "حُفظت محلياً — ستُزامَن عند عودة الاتصال" : "تم حفظ الطلبية",
    )
    void flushPending()
  }

  function discardOrder() {
    setLines([])
    setSelected(new Set())
    setSearch("")
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
    setDiscardOpen(false)
    toast.success("تم تجاهل الطلبية")
  }

  useEffect(() => {
    setPending(readPending())
    void flushPending()
    function onOnline() {
      void flushPending()
    }
    window.addEventListener("online", onOnline)
    const id = window.setInterval(() => {
      if (readPending().length) void flushPending()
    }, 20000)
    return () => {
      window.removeEventListener("online", onOnline)
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function downloadCsv() {
    downloadCsvRows(
      "purchase-order.csv",
      lines.map((l) => ({ name: l.name, barcode: l.barcode, qty: l.qty, cost: l.cost })),
    )
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const buyCost = useMemo(() => lines.reduce((s, l) => s + l.qty * l.cost, 0), [lines])
  const projectedGain = useMemo(
    () => lines.reduce((s, l) => s + l.qty * (l.price - l.cost), 0),
    [lines],
  )
  const companies = useMemo(
    () => Array.from(new Set(lines.map((l) => l.company).filter(Boolean))).sort(),
    [lines],
  )
  const categories = useMemo(
    () => Array.from(new Set(lines.map((l) => l.category).filter(Boolean))).sort(),
    [lines],
  )
  const activeFilters =
    (fCompany ? 1 : 0) +
    (fCategory ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0) +
    (costMin || costMax ? 1 : 0)

  const dSearch = useDebounced(search, 200)
  const filtered = useMemo(() => {
    const s = dSearch.trim().toLowerCase()
    const num = (v: string) => (v === "" ? null : Number(v))
    const pMin = num(priceMin)
    const pMax = num(priceMax)
    const cMin = num(costMin)
    const cMax = num(costMax)
    return lines.filter((l) => {
      if (s && !(l.name.toLowerCase().includes(s) || l.barcode.includes(s))) return false
      if (fCompany && l.company !== fCompany) return false
      if (fCategory && l.category !== fCategory) return false
      if (pMin != null && l.price < pMin) return false
      if (pMax != null && l.price > pMax) return false
      if (cMin != null && l.cost < cMin) return false
      if (cMax != null && l.cost > cMax) return false
      return true
    })
  }, [lines, dSearch, fCompany, fCategory, priceMin, priceMax, costMin, costMax])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === "asc" ? 1 : -1
    arr.sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === "name") {
        av = a.name
        bv = b.name
      } else if (sortKey === "barcode") {
        av = a.barcode
        bv = b.barcode
      } else if (sortKey === "stock") {
        av = a.stock
        bv = b.stock
      } else if (sortKey === "cost") {
        av = a.cost
        bv = b.cost
      } else if (sortKey === "qty") {
        av = a.qty
        bv = b.qty
      } else {
        av = a.qty * a.cost
        bv = b.qty * b.cost
      }
      if (typeof av === "string") return av.localeCompare(String(bv)) * dir
      return ((av as number) - (bv as number)) * dir
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const shownIds = useMemo(() => sorted.map((l) => l.medicationId), [sorted])
  useEffect(() => {
    setVisibleCount(80)
  }, [dSearch, fCompany, fCategory, priceMin, priceMax, costMin, costMax, sortKey, sortDir])
  const allShownSelected =
    shownIds.length > 0 && shownIds.every((id) => selected.has(id))

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("desc")
    }
  }
  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleSelectAll() {
    setSelected((prev) =>
      allShownSelected
        ? new Set([...prev].filter((id) => !shownIds.includes(id)))
        : new Set([...prev, ...shownIds]),
    )
  }
  function clearFilters() {
    setFCompany("")
    setFCategory("")
    setPriceMin("")
    setPriceMax("")
    setCostMin("")
    setCostMax("")
  }

  // Bulk actions on the selected lines
  function bulkDelete() {
    setLines((prev) => prev.filter((l) => !selected.has(l.medicationId)))
    setSelected(new Set())
  }
  function bulkAdjust(delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          selected.has(l.medicationId)
            ? { ...l, qty: Math.max(0, l.qty + delta) }
            : l,
        )
        .filter((l) => l.qty > 0),
    )
  }
  function bulkSet(v: number) {
    if (v <= 0) {
      bulkDelete()
      return
    }
    setLines((prev) =>
      prev.map((l) => (selected.has(l.medicationId) ? { ...l, qty: v } : l)),
    )
  }

  if (!isOwner) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="المشتريات" />
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          هذه الصفحة متاحة لمالك المتجر فقط.
        </p>
      </div>
    )
  }

  const selCount = selected.size
  const bulkN = parseInt(bulkAmount, 10)
  const bulkValid = Number.isFinite(bulkN)

  return (
    <div className="mx-auto w-full max-w-6xl pb-24">
      <PageHeader
        title="المشتريات"
        action={
          view === "new" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setGenOpen(true)}
                disabled={generating}
                className="gap-1.5"
                data-tour="purchases-generate"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {lines.length > 0 ? "توليد طلبية جديدة" : "توليد الطلبية"}
              </Button>
              <Button
                variant="outline"
                onClick={saveOrder}
                disabled={lines.length === 0}
                className="gap-1.5"
              >
                <Save className="size-4" />
                حفظ
              </Button>
              {lines.length > 0 && (
                <>
                  {/* Desktop: room to show the actions inline. */}
                  <Button
                    variant="outline"
                    onClick={() =>
                      printRows(
                        "طلبية شراء",
                        lines.map((l) => ({
                          name: l.name,
                          barcode: l.barcode,
                          qty: l.qty,
                          cost: l.cost,
                        })),
                      )
                    }
                    className="hidden gap-1.5 sm:inline-flex"
                  >
                    <Printer className="size-4" />
                    طباعة
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadCsv}
                    className="hidden gap-1.5 sm:inline-flex"
                  >
                    <Download className="size-4" />
                    تنزيل CSV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDiscardOpen(true)}
                    className="hidden gap-1.5 text-destructive hover:text-destructive sm:inline-flex"
                  >
                    <Trash2 className="size-4" />
                    تجاهل الطلبية
                  </Button>

                  {/* Mobile: collapse the same actions into a kebab to save space. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="المزيد"
                          className="sm:hidden"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          printRows(
                            "طلبية شراء",
                            lines.map((l) => ({
                              name: l.name,
                              barcode: l.barcode,
                              qty: l.qty,
                              cost: l.cost,
                            })),
                          )
                        }
                      >
                        <Printer className="size-4" />
                        طباعة
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={downloadCsv}>
                        <Download className="size-4" />
                        تنزيل CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDiscardOpen(true)}
                      >
                        <Trash2 className="size-4" />
                        تجاهل الطلبية
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-2">
        {(
          [
            ["new", "طلبية جديدة", ShoppingCart],
            ["history", "السجل", ClipboardList],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              view === key
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
        {view === "new" && lines.length > 0 && (
          <Badge variant="outline" className="ms-auto gap-1">
            <CloudOff className="size-3" />
            غير محفوظة بعد
          </Badge>
        )}
      </div>

      {view === "new" ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="عدد الأصناف" value={formatNumber(lines.length)} />
            <Stat label="إجمالي التكلفة" value={formatMoney(buyCost)} />
            <Stat label="الربح المتوقع" value={formatMoney(projectedGain)} tone="gain" />
          </div>

          {/* Add to order — normal width + barcode scan */}
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="أضِف صنفاً — بالاسم أو الباركود…"
              className="ps-9 pe-10"
              data-tour="purchases-search"
            />
            <button
              type="button"
              onClick={() => setScanMode("add")}
              aria-label="مسح لإضافة صنف"
              className="absolute inset-y-0 end-1.5 my-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ScanBarcode className="size-4" />
            </button>
            {addResults.length > 0 && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-card shadow-lg">
                {addResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      addMed(m)
                      setAddQuery("")
                      setAddResults([])
                    }}
                    className="flex w-full items-center gap-2 border-b p-2.5 text-start last:border-b-0 hover:bg-muted/50"
                  >
                    <Plus className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      مخزون {formatNumber(toNumber(m.stock))}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(m.cost)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table card */}
          <div className="rounded-2xl border bg-card" data-tour="purchases-cart">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
                <ShoppingCart className="size-8 opacity-40" />
                <p className="text-sm">ابدأ بـ «توليد الطلبية» أو أضِف أصنافاً بالبحث/المسح.</p>
                <Button onClick={() => setGenOpen(true)} disabled={generating} className="gap-1.5">
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  توليد الطلبية
                </Button>
              </div>
            ) : (
              <>
                {/* Toolbar: table search (normal size) + filters, OR bulk bar */}
                {selCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-2.5">
                    <span className="text-sm font-medium">محدد: {formatNumber(selCount)}</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={bulkDelete}
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </Button>
                    <input
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="كمية"
                      className="h-8 w-16 rounded-md border bg-background text-center text-sm tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!bulkValid}
                      onClick={() => bulkAdjust(Math.abs(bulkN))}
                    >
                      <Plus className="size-3.5" /> زيادة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!bulkValid}
                      onClick={() => bulkAdjust(-Math.abs(bulkN))}
                    >
                      <Minus className="size-3.5" /> إنقاص
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!bulkValid}
                      onClick={() => bulkSet(bulkN)}
                    >
                      تعيين
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ms-auto"
                      onClick={() => setSelected(new Set())}
                    >
                      إلغاء التحديد
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 border-b p-2.5">
                    <div className="relative w-full max-w-xs">
                      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="تصفية بالاسم أو الباركود…"
                        className="h-9 ps-9 pe-9"
                      />
                      <button
                        type="button"
                        onClick={() => setScanMode("filter")}
                        aria-label="مسح للتصفية"
                        className="absolute inset-y-0 end-1.5 my-auto grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ScanBarcode className="size-4" />
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowFilters((s) => !s)}
                      aria-expanded={showFilters}
                    >
                      <Filter className="size-4" />
                      تصفية
                      {activeFilters > 0 && (
                        <Badge variant="secondary" className="ms-1">
                          {activeFilters}
                        </Badge>
                      )}
                    </Button>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {formatNumber(sorted.length)} من {formatNumber(lines.length)}
                    </span>
                  </div>
                )}

                {/* Filter panel */}
                {showFilters && selCount === 0 && (
                  <div className="grid gap-3 border-b bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FilterSelect
                      label="الشركة"
                      value={fCompany}
                      onChange={setFCompany}
                      options={companies}
                    />
                    <FilterSelect
                      label="التصنيف"
                      value={fCategory}
                      onChange={setFCategory}
                      options={categories}
                    />
                    <RangeField
                      label="السعر"
                      min={priceMin}
                      max={priceMax}
                      onMin={setPriceMin}
                      onMax={setPriceMax}
                    />
                    <RangeField
                      label="التكلفة"
                      min={costMin}
                      max={costMax}
                      onMin={setCostMin}
                      onMax={setCostMax}
                    />
                    {activeFilters > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-fit gap-1.5 text-muted-foreground"
                        onClick={clearFilters}
                      >
                        <X className="size-4" /> مسح الفلاتر
                      </Button>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            aria-label="تحديد الكل"
                            className="grid place-items-center"
                          >
                            {allShownSelected ? (
                              <CheckSquare className="size-4 text-primary" />
                            ) : (
                              <Square className="size-4 text-muted-foreground" />
                            )}
                          </button>
                        </TableHead>
                        <SortHead label="الصنف" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="start" />
                        <SortHead label="الباركود" k="barcode" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="start" />
                        <SortHead label="المخزون" k="stock" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <SortHead label="التكلفة" k="cost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <SortHead label="الكمية" k="qty" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <SortHead label="الإجمالي" k="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.slice(0, visibleCount).map((l) => {
                        const sel = selected.has(l.medicationId)
                        return (
                          <TableRow key={l.medicationId} className={cn(sel && "bg-primary/5")}>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => toggleSelect(l.medicationId)}
                                aria-label="تحديد"
                                className="grid place-items-center"
                              >
                                {sel ? (
                                  <CheckSquare className="size-4 text-primary" />
                                ) : (
                                  <Square className="size-4 text-muted-foreground" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <p className="max-w-[14rem] truncate text-sm font-medium">{l.name}</p>
                              {l.company && (
                                <p className="truncate text-xs text-muted-foreground">{l.company}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-start text-sm tabular-nums text-muted-foreground">
                              {l.barcode || "—"}
                            </TableCell>
                            <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                              {formatNumber(l.stock)}
                            </TableCell>
                            <TableCell className="text-center text-sm tabular-nums">
                              {formatMoney(l.cost)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => setQty(l.medicationId, l.qty - 1)}
                                  aria-label="إنقاص"
                                >
                                  <Minus className="size-3.5" />
                                </Button>
                                <input
                                  value={l.qty}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value, 10)
                                    if (Number.isFinite(n)) setQty(l.medicationId, n)
                                  }}
                                  inputMode="numeric"
                                  aria-label="الكمية"
                                  className="h-8 w-12 rounded-md border bg-background text-center text-sm tabular-nums"
                                />
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => setQty(l.medicationId, l.qty + 1)}
                                  aria-label="زيادة"
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm font-semibold tabular-nums">
                              {formatMoney(l.qty * l.cost)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeLine(l.medicationId)}
                                aria-label="حذف"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {sorted.length > visibleCount && (
                  <div className="border-t p-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleCount((c) => c + 120)}
                    >
                      عرض المزيد ({formatNumber(sorted.length - visibleCount)})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scan FAB — brand gradient (matches the POS FAB) */}
          <button
            type="button"
            onClick={() => setScanMode("add")}
            aria-label="مسح باركود"
            style={{ backgroundImage: FAB_GRADIENT }}
            className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] end-4 z-30 grid size-14 place-items-center rounded-full text-white shadow-xl shadow-primary/35 transition-transform hover:scale-105 active:scale-95 md:bottom-6"
          >
            <ScanBarcode className="size-6" />
          </button>
        </>
      ) : (
        <HistoryView qc={qc} pending={pending} onRemovePending={removePending} />
      )}

      {/* Scanner overlay */}
      {scanMode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink">
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm font-semibold">
              {scanMode === "filter" ? "مسح للتصفية" : "مسح لإضافة صنف للطلبية"}
            </span>
            <button
              type="button"
              onClick={() => setScanMode(null)}
              aria-label="إغلاق"
              className="grid size-10 place-items-center rounded-full bg-white/10 active:scale-90"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <InlineScanner onDetect={onScan} className="h-full w-full rounded-none" />
          </div>
        </div>
      )}

      {/* Discard confirm */}
      <ConfirmDelete
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={discardOrder}
        title="تجاهل الطلبية"
        description="سيتم مسح الطلبية الحالية غير المحفوظة. لا يمكن التراجع."
        confirmLabel="تجاهل"
      />

      {/* Generate-criteria modal */}
      <Dialog open={genOpen} onOpenChange={(o) => setGenOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>توليد الطلبية</DialogTitle>
            <DialogDescription>
              نقترح الأصناف التي مخزونها عند حد إعادة الطلب أو أقل، بكمية تكفي فترة
              التغطية حسب متوسط البيع، مع التكلفة والربح المتوقع.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <NumberField
              id="gen-cover"
              label="أيام التغطية"
              value={genCover}
              onChange={setGenCover}
              hint={[
                "كم يوماً تريد أن تكفي الكمية المشتراة.",
                "أكبر = طلبات أكبر وأقل تكراراً.",
                "أصغر = طلبات أصغر وأكثر تكراراً.",
              ]}
            />
            <NumberField
              id="gen-days"
              label="أيام حساب متوسط البيع"
              value={genDays}
              onChange={setGenDays}
              hint={[
                "الفترة التي نحسب منها معدّل بيع كل صنف.",
                "٣٠ = متوسط الشهر الماضي.",
                "أصغر = يتبع الطلب الحديث بشكل أسرع.",
              ]}
            />
            <NumberField
              id="gen-threshold"
              label="حد المخزون المنخفض"
              value={genThreshold}
              onChange={setGenThreshold}
              hint={[
                "الأصناف التي مخزونها عند هذا الرقم أو أقل تُقترح للشراء.",
                "يُستخدم فقط للأصناف بلا حدّ إعادة طلب مخصّص.",
              ]}
            />
          </div>
          <DialogFooter>
            {/* Primary first → rightmost in RTL. */}
            <Button onClick={generate} className="gap-1.5">
              <Sparkles className="size-4" />
              توليد
            </Button>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SortHead({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "center",
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
  align?: "start" | "center"
}) {
  const active = sortKey === k
  return (
    <TableHead className={align === "start" ? "text-start" : "text-center"}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground",
          align === "center" && "mx-auto",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <option value="">الكل</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

function RangeField({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          value={min}
          onChange={(e) => onMin(e.target.value)}
          inputMode="decimal"
          placeholder="من"
          className="h-9"
          dir="ltr"
        />
        <Input
          value={max}
          onChange={(e) => onMax(e.target.value)}
          inputMode="decimal"
          placeholder="إلى"
          className="h-9"
          dir="ltr"
        />
      </div>
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  hint?: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && hint.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="شرح"
                  className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </button>
              }
            />
            <PopoverContent className="w-64" side="top">
              <ul className="list-disc space-y-1 pe-4 text-xs text-muted-foreground">
                {hint.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        dir="ltr"
      />
    </div>
  )
}

function HistoryView({
  qc,
  pending,
  onRemovePending,
}: {
  qc: ReturnType<typeof useQueryClient>
  pending: PendingOrder[]
  onRemovePending: (id: string) => void
}) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: purchaseOrdersList,
    staleTime: 15_000,
  })
  const [orderQuery, setOrderQuery] = useState("")
  const [toDelete, setToDelete] = useState<PurchaseOrder | null>(null)

  const receiveMut = useMutation({
    mutationFn: (id: number) => purchaseOrderReceive(id),
    onSuccess: () => {
      toast.success("تم الاستلام ورُفع المخزون")
      void qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      void qc.invalidateQueries({ queryKey: ["products"] })
      void qc.invalidateQueries({ queryKey: ["med-stats"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الاستلام"),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseOrderDelete(id),
    onSuccess: () => {
      toast.success("تم حذف الطلبية")
      setToDelete(null)
      void qc.invalidateQueries({ queryKey: ["purchase-orders"] })
      void qc.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحذف"),
  })

  const shown = useMemo(() => {
    const f = orderQuery.trim().toLowerCase()
    if (!f) return orders
    return orders.filter(
      (o) =>
        String(o.id).includes(f) ||
        o.supplier.toLowerCase().includes(f) ||
        o.items.some((it) => it.medication_name.toLowerCase().includes(f)),
    )
  }, [orders, orderQuery])

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }
  if (orders.length === 0 && pending.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
        لا توجد طلبيات محفوظة بعد.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
        <Input
          value={orderQuery}
          onChange={(e) => setOrderQuery(e.target.value)}
          placeholder="ابحث في السجل — رقم، مورّد، أو صنف…"
          className="ps-9"
        />
      </div>

      {pending.map((p) => (
        <div
          key={p.clientId}
          className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-bold">طلبية محلية</span>
            <Badge variant="destructive" className="gap-1">
              <CloudOff className="size-3" />
              بانتظار المزامنة
            </Badge>
            <span className="ms-auto font-heading text-sm font-bold tabular-nums">
              {formatMoney(p.total)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(p.count)} صنف
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                printRows(
                  "طلبية محلية",
                  p.items.map((it) => ({
                    name: it.medication_name,
                    barcode: it.barcode,
                    qty: toNumber(it.quantity),
                    cost: toNumber(it.unit_cost),
                  })),
                )
              }
            >
              <Printer className="size-4" />
              طباعة
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsvRows(
                  "purchase-order-local.csv",
                  p.items.map((it) => ({
                    name: it.medication_name,
                    barcode: it.barcode,
                    qty: toNumber(it.quantity),
                    cost: toNumber(it.unit_cost),
                  })),
                )
              }
            >
              <Download className="size-4" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => onRemovePending(p.clientId)}
            >
              <Trash2 className="size-4" />
              حذف
            </Button>
          </div>
        </div>
      ))}

      {shown.map((o) => (
        <div key={o.id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-bold">طلبية #{o.id}</span>
            {o.status === "received" ? (
              <Badge variant="secondary">مستلمة</Badge>
            ) : (
              <Badge variant="outline">مسودة</Badge>
            )}
            <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
            <span className="ms-auto font-heading text-sm font-bold tabular-nums">
              {formatMoney(o.total_cost)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(o.items.length)} صنف
            {o.supplier ? ` · ${o.supplier}` : ""}
            {o.created_by_name ? ` · ${o.created_by_name}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {o.status === "draft" && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={receiveMut.isPending}
                onClick={() => receiveMut.mutate(o.id)}
              >
                {receiveMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackageCheck className="size-4" />
                )}
                استلام (رفع المخزون)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                printRows(
                  `طلبية #${o.id}`,
                  o.items.map((it) => ({
                    name: it.medication_name,
                    barcode: it.barcode,
                    qty: toNumber(it.quantity),
                    cost: toNumber(it.unit_cost),
                  })),
                )
              }
            >
              <Printer className="size-4" />
              طباعة
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsvRows(
                  `purchase-order-${o.id}.csv`,
                  o.items.map((it) => ({
                    name: it.medication_name,
                    barcode: it.barcode,
                    qty: toNumber(it.quantity),
                    cost: toNumber(it.unit_cost),
                  })),
                )
              }
            >
              <Download className="size-4" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => setToDelete(o)}
            >
              <Trash2 className="size-4" />
              حذف
            </Button>
          </div>
        </div>
      ))}

      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
        loading={deleteMut.isPending}
        title="حذف الطلبية"
        description={
          toDelete?.status === "received"
            ? "هذه الطلبية مستلمة — سيُعاد خصم كمياتها من المخزون عند الحذف."
            : "سيتم حذف الطلبية نهائياً."
        }
        confirmLabel="حذف"
      />
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "gain"
}) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-lg font-bold tabular-nums",
          tone === "gain" && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  )
}
