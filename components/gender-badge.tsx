import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { GenderEnum } from "@/api/generated/model"

export function GenderBadge({
  gender,
  className,
}: {
  gender?: GenderEnum
  className?: string
}) {
  if (!gender) return null
  const isMale = gender === "male"
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-transparent",
        isMale
          ? "bg-chart-4/15 text-chart-4"
          : "bg-chart-2/15 text-chart-2",
        className,
      )}
    >
      {isMale ? "ذكر" : "أنثى"}
    </Badge>
  )
}
