"use client"

import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { EntityCombobox } from "@/components/entity-combobox"
import { useCustomersCatalog } from "@/hooks/use-customers-catalog"
import { cn } from "@/lib/utils"

/** Advanced sales filters shared by the print picker and the Sales page.
 *  CatalogItem name/barcode is a separate toolbar field on each page (it drives
 *  the `item` param); this panel holds the customer picker + the rest. */
export type SaleFilters = {
  customer: string
  customerLabel: string
  dateFrom: string
  dateTo: string
  minPrice: string
  maxPrice: string
  employee: string
  payment: string
}

export const EMPTY_SALE_FILTERS: SaleFilters = {
  customer: "",
  customerLabel: "",
  dateFrom: "",
  dateTo: "",
  minPrice: "",
  maxPrice: "",
  employee: "",
  payment: "",
}

const COUNT_KEYS: (keyof SaleFilters)[] = [
  "customer",
  "dateFrom",
  "dateTo",
  "minPrice",
  "maxPrice",
  "employee",
  "payment",
]

/** How many advanced filters are active (optionally ignoring payment, which
 *  some pages surface separately). */
export function activeSaleFilterCount(
  f: SaleFilters,
  opts?: { ignorePayment?: boolean },
) {
  return COUNT_KEYS.filter(
    (k) => f[k] && !(opts?.ignorePayment && k === "payment"),
  ).length
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function SaleFiltersPanel({
  f,
  patch,
  empOpts,
  onClear,
  showPayment = true,
}: {
  f: SaleFilters
  patch: (p: Partial<SaleFilters>) => void
  empOpts: Map<number, string>
  onClear: () => void
  /** Hide the payment select (pages that surface it elsewhere). */
  showPayment?: boolean
}) {
  const { fetcher } = useCustomersCatalog()

  return (
    <div className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 gap-2.5 rounded-2xl border bg-muted/30 p-3 duration-200">
      {/* Customer — searchable dropdown (name or phone) */}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">الزبون (بالاسم أو الهاتف)</Label>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <EntityCombobox
              value={f.customer ? Number(f.customer) : null}
              label={f.customerLabel}
              onChange={(opt) =>
                patch({
                  customer: opt ? String(opt.id) : "",
                  customerLabel: opt?.label ?? "",
                })
              }
              fetcher={fetcher}
              placeholder="كل الزبائن"
              searchPlaceholder="ابحث بالاسم أو الهاتف…"
              emptyText="لا يوجد زبائن مطابقون"
            />
          </div>
          {f.customer && (
            <button
              type="button"
              onClick={() => patch({ customer: "", customerLabel: "" })}
              aria-label="مسح الزبون"
              className="grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">من تاريخ</Label>
        <Input type="date" dir="ltr" value={f.dateFrom} onChange={(e) => patch({ dateFrom: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">إلى تاريخ</Label>
        <Input type="date" dir="ltr" value={f.dateTo} onChange={(e) => patch({ dateTo: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">السعر من</Label>
        <Input type="number" dir="ltr" className="text-start" placeholder="0" value={f.minPrice} onChange={(e) => patch({ minPrice: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">السعر إلى</Label>
        <Input type="number" dir="ltr" className="text-start" placeholder="∞" value={f.maxPrice} onChange={(e) => patch({ maxPrice: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">الموظف</Label>
        <select className={selectCls} value={f.employee} onChange={(e) => patch({ employee: e.target.value })}>
          <option value="">كل الموظفين</option>
          {[...empOpts.entries()].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>
      {showPayment && (
        <div className="space-y-1">
          <Label className="text-xs">الدفع</Label>
          <select className={selectCls} value={f.payment} onChange={(e) => patch({ payment: e.target.value })}>
            <option value="">الكل</option>
            <option value="cash">نقدي</option>
            <option value="debt">دين</option>
          </select>
        </div>
      )}
      <div className={cn("flex items-end", showPayment ? "" : "col-start-2 justify-end")}>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClear}>
          <X className="size-4" />
          مسح الفلاتر
        </Button>
      </div>
    </div>
  )
}
