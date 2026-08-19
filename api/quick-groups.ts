"use client"

import { customFetch } from "@/api/http"

/**
 * The POS's quick-tap cards, stored on the STORE.
 *
 * Not in localStorage: this is how the shop works, not a preference of one
 * machine. A cleared browser cache, or a second till, must not lose it.
 */
export type QuickGroup = {
  key: string
  label: string
  /** Icon name — see QUICK_ICONS in components/pos/quick-cards.tsx. */
  icon: string
  product_ids: number[]
}

export const getQuickGroups = () =>
  customFetch<{ data: { groups: QuickGroup[] } }>(
    `/api/v1/store/quick-groups/`,
  )

export const putQuickGroups = (groups: QuickGroup[]) =>
  customFetch<{ data: { groups: QuickGroup[] } }>(
    `/api/v1/store/quick-groups/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups }),
    },
  )
