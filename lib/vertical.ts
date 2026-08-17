/**
 * Which vertical this deployment serves — pharmacy, supermarket or a general
 * shop. Drives labels and which optional fields show.
 *
 * A vertical is CONFIGURATION, not a fork: one codebase serves all of them, so
 * a fix lands once. Set NEXT_PUBLIC_VERTICAL at build time.
 */
export type Vertical = "pharmacy" | "supermarket" | "shop"

type VerticalConfig = {
  labelAr: string
  productLabelAr: string
  trackExpiry: boolean
}

const CONFIG: Record<Vertical, VerticalConfig> = {
  pharmacy:    { labelAr: "صيدلية",     productLabelAr: "دواء",  trackExpiry: true  },
  supermarket: { labelAr: "سوبرماركت", productLabelAr: "منتج", trackExpiry: true  },
  shop:        { labelAr: "متجر",       productLabelAr: "منتج", trackExpiry: false },
}

export function vertical(): Vertical {
  const v = process.env.NEXT_PUBLIC_VERTICAL as Vertical | undefined
  return v && v in CONFIG ? v : "shop"
}

export function verticalConfig(): VerticalConfig {
  return CONFIG[vertical()]
}
