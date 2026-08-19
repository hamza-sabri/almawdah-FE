"use client"

import type { CatalogMed } from "@/api/sales"
import type { QuickGroup } from "@/api/quick-groups"

/**
 * The cards the POS shows above the barcode-less list.
 *
 * A shop that has never configured anything still needs sensible cards on day
 * one, so these are derived from the catalogue by name. The moment the owner
 * edits them they are saved on the store and these defaults stop being used —
 * they are a starting point, not a rule.
 *
 * Ordering inside a card follows the shop's own history: سيجارة حلل carries
 * 14,257 sale lines, دخان امبريال 1,681, دخان عربي 1,439, دخان عالية 267.
 */

export const QUICK_DEFAULTS: Array<{
  key: string
  label: string
  icon: string
  match: RegExp
  /** Names that should lead the card, most-sold first. */
  lead: string[]
}> = [
  {
    key: "smoke",
    label: "دخان",
    icon: "cigarette",
    match: /دخان|سيجارة|سجائر|سجاير|تبغ|معسل|لفائف|مانشستر/,
    lead: ["سيجارة حلل", "دخان امبريال", "دخان عربي", "دخان عالية"],
  },
  { key: "eggs", label: "بيض", icon: "egg", match: /^بيض|بيضة/, lead: ["بيض"] },
  // Deliberately NO top-up card. شحن رصيد is stored at a nominal ₪1, so a
  // one-tap card would put ₪1 on the receipt instead of the ₪10–₪100 the
  // customer actually paid. That is what the جوال button above the cart is
  // for — it asks the amount first and adds nothing until it is picked.
]

/**
 * How many products a DERIVED card may hold. A card is a shortcut; a shortcut
 * with forty entries is just the list again. The owner raises it himself by
 * adding items with the + — that path is capped at 60 by the backend.
 */
const DEFAULT_MAX = 12

/**
 * Only items nobody can scan get a default card.
 *
 * A barcoded pack is already one trigger-pull away; putting it on a card buys
 * nothing and pushes the things that DO need a shortcut off the end. Same rule
 * as the list underneath — see isQuickItem in components/pos/quick-items-panel.
 * Deliberately re-stated here rather than imported: the panel imports the
 * cards, so importing it back would close a cycle.
 */
function needsAShortcut(m: CatalogMed): boolean {
  return !(m.barcode || "").trim() && (m.alt_barcodes ?? []).length === 0
}

function leadRank(name: string, lead: string[]): number {
  const i = lead.findIndex((l) => name.trim().startsWith(l))
  return i === -1 ? Infinity : i
}

/** Build the starting cards from whatever this shop actually sells. */
export function defaultGroups(catalog: CatalogMed[]): QuickGroup[] {
  const out: QuickGroup[] = []
  for (const d of QUICK_DEFAULTS) {
    const hits = catalog.filter((m) => needsAShortcut(m) && d.match.test(m.name))
    if (hits.length === 0) continue
    hits.sort((a, b) => {
      const ra = leadRank(a.name, d.lead)
      const rb = leadRank(b.name, d.lead)
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, "ar")
    })
    out.push({
      key: d.key,
      label: d.label,
      icon: d.icon,
      product_ids: hits.slice(0, DEFAULT_MAX).map((m) => m.id),
    })
  }
  return out
}

/**
 * Resolve a group's ids to live products.
 *
 * Ids that no longer exist are dropped silently — a product deleted months ago
 * must not leave a dead tile on the till, and must not make the layout
 * unopenable either.
 */
export function groupProducts(
  group: QuickGroup,
  catalog: CatalogMed[],
): CatalogMed[] {
  const byId = new Map(catalog.map((m) => [m.id, m]))
  return group.product_ids
    .map((id) => byId.get(id))
    .filter((m): m is CatalogMed => Boolean(m))
}

/** Everything not already on a card, for the plain list underneath. */
export function ungrouped(
  groups: QuickGroup[],
  catalog: CatalogMed[],
): CatalogMed[] {
  const taken = new Set(groups.flatMap((g) => g.product_ids))
  return catalog.filter((m) => !taken.has(m.id))
}
