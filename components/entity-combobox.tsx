"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useDebounced } from "@/hooks/use-debounced"
import { cn } from "@/lib/utils"

export type ComboOption = {
  id: number
  label: string
  sub?: string
  /** Optional payload (e.g. a product's price) for the caller to use. */
  price?: string
  /** Optional text shown on the far (end) side of the row, e.g. a price. */
  trailing?: string
}

/** A popover + command combobox that searches the server as you type. */
export function EntityCombobox({
  value,
  label,
  onChange,
  fetcher,
  placeholder = "اختر…",
  searchPlaceholder = "ابحث…",
  emptyText = "لا نتائج",
  className,
  disabled,
}: {
  value: number | null | undefined
  label?: string
  onChange: (opt: ComboOption | null) => void
  fetcher: (search: string) => Promise<ComboOption[]>
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedLabel, setSelectedLabel] = useState(label ?? "")
  const debounced = useDebounced(search, 300)

  useEffect(() => {
    if (label !== undefined) setSelectedLabel(label)
  }, [label])

  const { data: options = [], isFetching } = useQuery({
    queryKey: ["combobox", searchPlaceholder, debounced],
    queryFn: () => fetcher(debounced),
    enabled: open,
    staleTime: 15_000,
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">
              {value && selectedLabel ? selectedLabel : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {isFetching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                جارٍ البحث…
              </div>
            )}
            {!isFetching && options.length === 0 && (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={String(opt.id)}
                  onSelect={() => {
                    onChange(opt)
                    setSelectedLabel(opt.label)
                    setOpen(false)
                    setSearch("")
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{opt.label}</span>
                    {opt.sub && (
                      <span className="truncate text-xs text-muted-foreground">
                        {opt.sub}
                      </span>
                    )}
                  </div>
                  {opt.trailing && (
                    <span className="shrink-0 font-heading text-sm font-bold text-primary">
                      {opt.trailing}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
