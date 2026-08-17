/**
 * Sales taken while offline sit in the IndexedDB queue until they sync. When
 * the offline read layer merges them into the /sales/ list it stamps them with
 * NEGATIVE ids (see lib/offline/reads.ts) — the server never issues one, so
 * the sign is a safe "this row only exists on this device" marker.
 *
 * Two things follow, and both matter:
 *
 *   1. The row must SAY so. Otherwise the cashier sees the sale in the history
 *      and assumes it's banked; if the tab is cleared before the queue drains,
 *      it isn't.
 *   2. Anything keyed on a real server id — void, refund, anything that PATCHes
 *      /sales/<id>/ — must refuse it, or the API gets handed id=-1.
 */

export const LOCAL_SALE_LABEL = "بانتظار المزامنة"

export function isLocalSale(id: number | null | undefined): boolean {
  return typeof id === "number" && id < 0
}

/** What to show where a receipt number would go. */
export function saleNumberLabel(id: number): string {
  return isLocalSale(id) ? `بيع محلي — ${LOCAL_SALE_LABEL}` : `بيع رقم ${id}`
}
