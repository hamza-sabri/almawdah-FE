"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, PlusCircle, X } from "lucide-react"

import { taxonomyList } from "@/api/sales"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDebounced } from "@/hooks/use-debounced"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Search-or-create dropdown for category / manufacturer. The value is the
 * plain name string — picking an existing row or typing a brand-new name is
 * the same one gesture; the backend creates the canonical row on save.
 */
export function TaxonomyCombobox({
  kind,
  value,
  onChange,
  placeholder = "بدون",
  className,
}: {
  kind: "categories" | "manufacturers"
  value: string
  onChange: (name: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debounced = useDebounced(search, 250)

  const { data: options = [], isFetching } = useQuery({
    queryKey: ["taxonomy", kind, debounced],
    queryFn: async () => (await taxonomyList(kind, debounced)).data.results,
    enabled: open,
    staleTime: 30_000,
  })

  const trimmed = search.trim()
  const exactExists = options.some(
    (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
  )

  function pick(name: string) {
    onChange(name)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="ابحث أو اكتب اسماً جديداً…"
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                جارٍ البحث…
              </div>
            )}
            <CommandGroup>
              {/* Type something new → create it in place, no extra screens. */}
              {trimmed && !exactExists && (
                <CommandItem
                  value="__create__"
                  onSelect={() => pick(trimmed)}
                  className="gap-2 font-medium text-primary"
                >
                  <PlusCircle className="size-4 shrink-0" />
                  <span className="truncate">إضافة «{trimmed}»</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={String(opt.id)}
                  onSelect={() => pick(opt.name)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === opt.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                  {opt.count > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatNumber(opt.count)}
                    </span>
                  )}
                </CommandItem>
              ))}
              {!isFetching && value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => pick("")}
                  className="gap-2 text-muted-foreground"
                >
                  <X className="size-4 shrink-0" />
                  إزالة التحديد
                </CommandItem>
              )}
              {!isFetching && !trimmed && options.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  لا خيارات بعد — اكتب لإنشاء أول واحد
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
