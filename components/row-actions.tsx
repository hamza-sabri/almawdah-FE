"use client"

import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type RowAction = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  className?: string
}

export function RowActions({
  onEdit,
  onDelete,
  extra = [],
}: {
  onEdit?: () => void
  onDelete?: () => void
  /** Quick actions rendered ABOVE edit/delete. */
  extra?: RowAction[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <MoreVertical className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        {extra.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onClick={a.onClick}
            className={a.className}
          >
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" />
            تعديل
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            حذف
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
