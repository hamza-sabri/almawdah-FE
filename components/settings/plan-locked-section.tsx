"use client"

import { Lock } from "lucide-react"

import { useLockedFeature } from "@/components/locked-feature"

/**
 * A settings section that exists in the product but is not on this store's
 * plan.
 *
 * Deliberately rendered rather than hidden. Hiding it makes the app look
 * thinner than it is and leaves the owner unaware the capability exists;
 * showing it greyed, with the padlock and one honest sentence, tells him it is
 * there without turning his settings page into an upsell. Tapping explains,
 * once, and gets out of the way.
 */
export function PlanLockedSection({
  title,
  description,
  featureLabel,
}: {
  title: string
  description: string
  /** What the dialog names when it explains the lock. Defaults to `title`. */
  featureLabel?: string
}) {
  const { openPlanLocked } = useLockedFeature()
  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <button
        type="button"
        onClick={() => openPlanLocked(featureLabel ?? title)}
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-start justify-between gap-3 text-start"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="font-heading text-base font-bold text-muted-foreground/80">
              {title}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/70">
            {description}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/70">
          غير مشمولة
        </span>
      </button>
    </section>
  )
}
