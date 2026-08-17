"use client"

import { ArrowUpDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type SortOption = { value: string; label: string }

export function SortMenu({
  value,
  options,
  onChange,
}: {
  value: string
  options: SortOption[]
  onChange: (v: string) => void
}) {
  const current = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowUpDown className="size-4" />
            <span className="hidden sm:inline">
              {current?.label ?? "ترتيب"}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className="justify-between gap-3"
          >
            {o.label}
            <Check
              className={cn(
                "size-4",
                value === o.value ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
