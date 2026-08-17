"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, Save, Trash2, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  COLOR_KEY,
  SIZE_KEY,
  OPTION_PRESETS,
  COLOR_PRESETS,
  SIZE_PRESETS,
  colorHexOf,
} from "@/lib/variant-options"
import {
  createVariant,
  deleteVariant,
  listVariants,
  updateVariant,
  type Variant,
} from "@/api/variants"

type Opt = { name: string; values: string[] }

type Combo = {
  key: string
  id?: number
  attributes: Record<string, string>
  label: string
  labelTouched?: boolean
  price: string
  cost: string
  stock: string
  barcode: string
  is_active: boolean
  dirty?: boolean
}

function comboKey(attributes: Record<string, string>): string {
  return Object.keys(attributes)
    .sort()
    .map((k) => `${k}=${attributes[k]}`)
    .join("|")
}

function autoLabel(attributes: Record<string, string>, order: string[]): string {
  const ordered = order.map((n) => attributes[n]).filter(Boolean)
  const rest = Object.keys(attributes)
    .filter((k) => !order.includes(k))
    .map((k) => attributes[k])
  return [...ordered, ...rest].filter(Boolean).join(" / ")
}

function cartesian(options: Opt[]): Record<string, string>[] {
  const active = options.filter((o) => o.name.trim() && o.values.length)
  if (!active.length) return []
  let acc: Record<string, string>[] = [{}]
  for (const o of active) {
    const next: Record<string, string>[] = []
    for (const base of acc)
      for (const v of o.values) next.push({ ...base, [o.name.trim()]: v })
    acc = next
  }
  return acc
}

function variantToCombo(v: Variant): Combo {
  const attributes = (v.attributes as Record<string, string>) ?? {}
  return {
    key: `id:${v.id}`,
    id: v.id,
    attributes,
    label: v.label,
    price: v.price ?? "",
    cost: v.cost ?? "",
    stock: v.stock ?? "0",
    barcode: v.barcode ?? "",
    is_active: v.is_active,
  }
}

function deriveOptions(variants: Variant[]): Opt[] {
  const map = new Map<string, string[]>()
  for (const v of variants) {
    const attributes = (v.attributes as Record<string, string>) ?? {}
    for (const [k, raw] of Object.entries(attributes)) {
      const value = String(raw ?? "").trim()
      if (!value) continue
      const values = map.get(k) ?? []
      if (!values.includes(value)) values.push(value)
      map.set(k, values)
    }
  }
  return [...map.entries()].map(([name, values]) => ({ name, values }))
}

function ValueTextAdder({
  placeholder = "قيمة",
  onAdd,
}: {
  placeholder?: string
  onAdd: (value: string) => void
}) {
  const [text, setText] = useState("")
  function submit() {
    onAdd(text)
    setText("")
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        className="h-8 w-28"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={submit}
        className="h-8 px-2"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

function OptionCard({
  option,
  index,
  onPatch,
  onRemove,
}: {
  option: Opt
  index: number
  onPatch: (i: number, p: Partial<Opt>) => void
  onRemove: (i: number) => void
}) {
  const name = option.name.trim()
  const isColor = name === COLOR_KEY
  const isSize = name === SIZE_KEY

  function addValue(value: string) {
    const v = value.trim()
    if (!v || option.values.includes(v)) return
    onPatch(index, { values: [...option.values, v] })
  }
  function removeValue(value: string) {
    onPatch(index, { values: option.values.filter((x) => x !== value) })
  }

  return (
    <div className="space-y-2.5 rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <Input
          value={option.name}
          onChange={(e) => onPatch(index, { name: e.target.value })}
          placeholder="اسم الخيار (لون، حجم…)"
          className="h-8 flex-1 font-semibold"
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="حذف الخيار"
          className="text-muted-foreground/60 transition hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>

      {option.values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {option.values.map((v) => {
            const hex = colorHexOf(v)
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pe-1 ps-2 text-xs"
              >
                {isColor && hex && (
                  <span
                    className="size-3.5 rounded-full border"
                    style={{ background: hex }}
                  />
                )}
                <span>{v}</span>
                <button
                  type="button"
                  onClick={() => removeValue(v)}
                  aria-label="حذف القيمة"
                  className="text-muted-foreground/60 transition hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {isColor ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              aria-label={p.name}
              onClick={() => addValue(p.name)}
              className="size-6 rounded-full border shadow-sm transition hover:scale-110"
              style={{ background: p.hex }}
            />
          ))}
          <label
            className="grid size-6 cursor-pointer place-items-center rounded-full border border-dashed text-muted-foreground transition hover:text-primary"
            title="لون مخصص"
          >
            <Plus className="size-3.5" />
            <input
              type="color"
              className="sr-only"
              onChange={(e) => addValue(e.target.value)}
            />
          </label>
        </div>
      ) : isSize ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {SIZE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addValue(s)}
              className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              {s}
            </button>
          ))}
          <ValueTextAdder onAdd={addValue} />
        </div>
      ) : (
        <ValueTextAdder onAdd={addValue} />
      )}
    </div>
  )
}

export function VariantsManager({
  open,
  onOpenChange,
  medicationId,
  medicationName,
  medicationPrice = "",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  medicationId: number | null
  medicationName: string
  medicationPrice?: string
}) {
  const qc = useQueryClient()
  const [options, setOptions] = useState<Opt[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [loading, setLoading] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  useEffect(() => {
    if (!open || !medicationId) return
    setOptions([])
    setCombos([])
    setLoading(true)
    void listVariants(medicationId)
      .then((r) => {
        const variants = r.data.results
        setOptions(deriveOptions(variants))
        setCombos(variants.map(variantToCombo))
      })
      .catch(() => toast.error("تعذر تحميل الأنواع"))
      .finally(() => setLoading(false))
  }, [open, medicationId])

  const order = options.map((o) => o.name.trim()).filter(Boolean)

  useEffect(() => {
    const tuples = cartesian(options)
    if (!tuples.length) return
    const activeOrder = options
      .filter((o) => o.name.trim() && o.values.length)
      .map((o) => o.name.trim())
    setCombos((prev) => {
      const prevByKey = new Map(
        prev
          .filter((c) => Object.keys(c.attributes).length)
          .map((c) => [comboKey(c.attributes), c]),
      )
      const generated = tuples.map((attributes) => {
        const k = comboKey(attributes)
        const existing = prevByKey.get(k)
        if (existing) {
          return {
            ...existing,
            attributes,
            label: existing.labelTouched
              ? existing.label
              : autoLabel(attributes, activeOrder),
          }
        }
        return {
          key: `k:${k}`,
          attributes,
          label: autoLabel(attributes, activeOrder),
          price: medicationPrice || "",
          cost: "",
          stock: "0",
          barcode: "",
          is_active: true,
          dirty: true,
        }
      })
      const generatedKeys = new Set(tuples.map(comboKey))
      const persistedOrphans = prev.filter(
        (c) =>
          c.id &&
          Object.keys(c.attributes).length &&
          !generatedKeys.has(comboKey(c.attributes)),
      )
      const manual = prev.filter((c) => Object.keys(c.attributes).length === 0)
      return [...generated, ...persistedOrphans, ...manual]
    })
  }, [options, medicationPrice])

  function patchOption(i: number, p: Partial<Opt>) {
    setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...p } : o)))
  }
  function removeOption(i: number) {
    setOptions((os) => os.filter((_, j) => j !== i))
  }
  function addOption(name: string) {
    if (name && options.some((o) => o.name.trim() === name)) return
    setOptions((os) => [...os, { name, values: [] }])
  }

  function patchCombo(i: number, p: Partial<Combo>) {
    setCombos((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)))
  }

  function addManualCombo() {
    setCombos((cs) => [
      ...cs,
      {
        key: `manual:${cs.length}:${cs.reduce((n, c) => n + c.label.length, 0)}`,
        attributes: {},
        label: "",
        price: medicationPrice || "",
        cost: "",
        stock: "0",
        barcode: "",
        is_active: true,
        dirty: true,
      },
    ])
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["products"] })
    qc.invalidateQueries({ queryKey: ["pos-catalog"] })
    qc.invalidateQueries({ queryKey: ["med-stats"] })
  }

  async function removeCombo(i: number) {
    const combo = combos[i]
    if (combo.id) {
      try {
        await deleteVariant(combo.id)
        invalidate()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر الحذف")
        return
      }
    }
    setCombos((cs) => cs.filter((_, j) => j !== i))
  }

  async function saveAll() {
    if (!medicationId) return
    const targets = combos
      .map((combo, i) => ({ combo, i }))
      .filter(({ combo }) => combo.dirty || !combo.id)
    if (!targets.length) {
      toast.info("لا تغييرات للحفظ")
      return
    }
    if (targets.some(({ combo }) => !combo.price.trim())) {
      toast.error("لكل تركيبة سعر مطلوب")
      return
    }
    setSavingAll(true)
    let saved = 0
    try {
      for (const { combo, i } of targets) {
        const body = {
          product: medicationId,
          label: combo.label.trim() || autoLabel(combo.attributes, order),
          barcode: combo.barcode.trim(),
          price: combo.price,
          cost: combo.cost.trim() || "0",
          stock: combo.stock.trim() || "0",
          is_active: combo.is_active,
          attributes: combo.attributes,
        }
        if (combo.id) {
          await updateVariant(combo.id, body)
          patchCombo(i, { dirty: false })
        } else {
          const res = await createVariant(body)
          patchCombo(i, { id: res.data.id, key: `id:${res.data.id}`, dirty: false })
        }
        saved += 1
      }
      toast.success(`تم حفظ ${saved} تركيبة`)
      invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    } finally {
      setSavingAll(false)
    }
  }

  const dirtyCount = combos.filter((c) => c.dirty || !c.id).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>أنواع «{medicationName}»</DialogTitle>
          <DialogDescription>
            حدّد الخيارات (لون، حجم…) وستظهر تركيبة لكل قيمة، سعّر كل واحدة ثم
            احفظ.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[64dvh] space-y-4 overflow-y-auto pe-1">
          {loading && (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}

          {!loading && (
            <>
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground">
                    الخيارات
                  </Label>
                </div>
                {options.map((option, i) => (
                  <OptionCard
                    key={i}
                    option={option}
                    index={i}
                    onPatch={patchOption}
                    onRemove={removeOption}
                  />
                ))}
                <div className="flex flex-wrap gap-1.5">
                  {OPTION_PRESETS.filter(
                    (p) => !options.some((o) => o.name.trim() === p),
                  ).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => addOption(p)}
                      className="rounded-md bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    >
                      + {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption("")}
                    className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-[11px] font-medium text-primary"
                  >
                    <Plus className="size-3" />
                    خيار مخصص
                  </button>
                </div>
              </section>

              <section className="space-y-2.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  التركيبات — لكل واحدة سعرها{" "}
                  {combos.length > 0 ? `· ${combos.length}` : ""}
                </Label>
                {combos.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    أضف خيارًا وقيمة بالأعلى (مثلاً «الحجم» = «M») وستظهر هنا
                    تركيبة لكل قيمة مع حقل سعرها.
                  </p>
                )}
                {combos.map((combo, i) => (
                  <div
                    key={combo.key}
                    className={cn(
                      "space-y-2 rounded-2xl border bg-card p-3",
                      combo.dirty && "border-primary/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {Object.entries(combo.attributes).map(([k, v]) => {
                          const hex = colorHexOf(v)
                          return hex ? (
                            <span
                              key={k}
                              title={`${k}: ${v}`}
                              className="size-4 rounded-full border"
                              style={{ background: hex }}
                            />
                          ) : null
                        })}
                      </div>
                      <Input
                        value={combo.label}
                        onChange={(e) =>
                          patchCombo(i, {
                            label: e.target.value,
                            labelTouched: true,
                            dirty: true,
                          })
                        }
                        placeholder="اسم التركيبة"
                        className="h-8 flex-1 font-medium"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">السعر</Label>
                        <Input
                          value={combo.price}
                          onChange={(e) =>
                            patchCombo(i, { price: e.target.value, dirty: true })
                          }
                          inputMode="decimal"
                          dir="ltr"
                          className="h-9 text-center"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">التكلفة</Label>
                        <Input
                          value={combo.cost}
                          onChange={(e) =>
                            patchCombo(i, { cost: e.target.value, dirty: true })
                          }
                          inputMode="decimal"
                          dir="ltr"
                          className="h-9 text-center"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">المخزون</Label>
                        <Input
                          value={combo.stock}
                          onChange={(e) =>
                            patchCombo(i, { stock: e.target.value, dirty: true })
                          }
                          inputMode="decimal"
                          dir="ltr"
                          className="h-9 text-center"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">الباركود</Label>
                      <Input
                        value={combo.barcode}
                        onChange={(e) =>
                          patchCombo(i, { barcode: e.target.value, dirty: true })
                        }
                        placeholder="اختياري"
                        dir="ltr"
                        className="h-9 text-start"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          size="sm"
                          checked={combo.is_active}
                          onCheckedChange={(v) =>
                            patchCombo(i, { is_active: v, dirty: true })
                          }
                        />
                        مفعّل
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCombo(i)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addManualCombo}
                  className="w-full"
                >
                  <Plus className="size-4" />
                  إضافة نوع واحد يدويًا
                </Button>
              </section>
            </>
          )}
        </div>

        <Button
          type="button"
          onClick={saveAll}
          disabled={savingAll || dirtyCount === 0}
          className="w-full"
        >
          {savingAll ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          حفظ الكل{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
