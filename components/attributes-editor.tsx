"use client"

import { useState } from "react"
import { ChevronDown, Plus, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  COLOR_KEY,
  SIZE_KEY,
  OPTION_PRESETS as PRESETS,
  COLOR_PRESETS,
  SIZE_PRESETS,
} from "@/lib/variant-options"

type Pair = { k: string; v: string }

function toPairs(value: Record<string, string> | undefined): Pair[] {
  return Object.entries(value ?? {}).map(([k, v]) => ({ k, v: String(v ?? "") }))
}

function toObject(pairs: Pair[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of pairs) {
    const k = p.k.trim()
    if (k) out[k] = p.v.trim()
  }
  return out
}

/** Multiple colors, shown as swatches. Value is a comma-joined hex list. */
function ColorValue({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const colors = value
    ? value.split(",").map((c) => c.trim()).filter(Boolean)
    : []
  function setColors(next: string[]) {
    onChange(next.join(","))
  }
  function add(hex: string) {
    if (!colors.includes(hex)) setColors([...colors, hex])
  }
  return (
    <div className="flex flex-col gap-2">
      {colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {colors.map((c, i) => (
            <span key={`${c}-${i}`} className="relative inline-flex">
              <span
                className="size-8 rounded-full border shadow-sm"
                style={{ background: c }}
              />
              <button
                type="button"
                onClick={() => setColors(colors.filter((_, j) => j !== i))}
                aria-label="حذف اللون"
                className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-destructive text-white shadow"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            onClick={() => add(p.hex)}
            title={p.name}
            aria-label={p.name}
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
            onChange={(e) => add(e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}

/** Free size text with quick presets. */
function SizeValue({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="القيمة"
        className="h-8"
      />
      <div className="flex flex-wrap gap-1.5">
        {SIZE_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
              value === s
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-primary/10 hover:text-primary",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function AttrValue({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (v: string) => void
}) {
  if (name.trim() === COLOR_KEY)
    return <ColorValue value={value} onChange={onChange} />
  if (name.trim() === SIZE_KEY)
    return <SizeValue value={value} onChange={onChange} />
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="القيمة"
      className="h-8"
    />
  )
}

/** Optional, collapsed-by-default key/value editor for product properties
 *  (color, size, flavor, …). Hidden until the user opens it. */
export function AttributesEditor({
  value,
  onChange,
  title = "خصائص إضافية (اختياري)",
}: {
  value: Record<string, string> | undefined
  onChange: (v: Record<string, string>) => void
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [pairs, setPairs] = useState<Pair[]>(() => toPairs(value))

  function commit(next: Pair[]) {
    setPairs(next)
    onChange(toObject(next))
  }
  function addPair(k = "") {
    setOpen(true)
    commit([...pairs, { k, v: "" }])
  }
  const count = pairs.filter((p) => p.k.trim()).length

  return (
    <div className="rounded-xl border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground"
      >
        <span>
          {title}
          {count > 0 ? ` · ${count}` : ""}
        </span>
        <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {pairs.map((p, i) => (
            <div key={i} className="rounded-xl border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={p.k}
                  onChange={(e) =>
                    commit(pairs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))
                  }
                  placeholder="الخاصية"
                  className="h-8 flex-1"
                />
                <button
                  type="button"
                  onClick={() => commit(pairs.filter((_, j) => j !== i))}
                  className="text-muted-foreground/60 transition hover:text-destructive"
                  aria-label="حذف الخاصية"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-2">
                <AttrValue
                  name={p.k}
                  value={p.v}
                  onChange={(v) =>
                    commit(pairs.map((x, j) => (j === i ? { ...x, v } : x)))
                  }
                />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESETS.filter((pr) => !pairs.some((p) => p.k === pr)).map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => addPair(pr)}
                className="rounded-md bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
              >
                + {pr}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addPair()}
              className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-[11px] font-medium text-primary"
            >
              <Plus className="size-3" />
              مخصص
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
