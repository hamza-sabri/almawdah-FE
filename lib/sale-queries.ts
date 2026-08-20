"use client"

import type { QueryClient } from "@tanstack/react-query"

/**
 * Everything on screen that a changed sale makes wrong.
 *
 * ONE list, because five places used to keep their own copy — the checkout,
 * the void, the wipe, the revision restore, and the offline-sync flush — and
 * they were only ever as correct as whoever last remembered all five. Adding
 * the day-summary cards proved the point immediately: four of the five were
 * updated, the fifth was not, and the owner rang up a sale and watched the
 * cards keep yesterday's number until he reloaded the page.
 *
 * A stale figure on a till is not a cosmetic problem. It is the owner reading
 * a total that is quietly wrong and having no reason to doubt it.
 */
export const SALE_AFFECTED_KEYS: string[][] = [
  ["products"], // stock moved
  ["pos-catalog"], // …and the till's own copy of it
  ["sales"], // the history list
  ["sales-stats"], // the period totals
  ["sales-day-summary"], // the جوال / دخان / total cards
  ["debts"], // a credit sale changes a balance
  ["dashboard-stats"],
  ["customers"],
  ["customers-quick"],
]

/**
 * Refresh everything a changed sale touches.
 *
 * Call after ANY write to a sale — created, edited, restored, voided, wiped,
 * or synced up from the offline queue.
 */
export function invalidateSaleData(qc: QueryClient): void {
  for (const queryKey of SALE_AFFECTED_KEYS) {
    qc.invalidateQueries({ queryKey })
  }
}
