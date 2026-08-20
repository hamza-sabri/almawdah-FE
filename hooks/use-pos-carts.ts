"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Product } from "@/api/generated/model"
import { convexAccountId } from "@/lib/convex"
import { toNumber } from "@/lib/format"
import { uuid } from "@/lib/offline/queue"
import { newReceiptCode } from "@/lib/receipt-code"

/**
 * POS carts with parking: several sales can be open at once (a customer walks
 * in mid-sale → park the current cart, serve them, come back).
 *
 * CARTS DO NOT LEAVE THIS BROWSER. There is no server copy and no realtime
 * subscription — localStorage, keyed per account, is the whole story.
 *
 * They used to sync: a per-user row on the API, plus a Convex document pushed
 * live to every device. Both were correctly scoped in code and both leaked
 * anyway — the Convex deployment URL was a Dockerfile default, so every shop
 * built from this template joined ONE realtime database keyed by an account id
 * that is only unique inside a single shop's own database. Two shops' tills
 * showed each other's open baskets, and closed carts came back from copies
 * nobody could see.
 *
 * A parked basket is worth very little. A till showing a basket the cashier
 * did not create is worth a great deal of trouble. So the feature is gone
 * rather than guarded: with nothing to write to and nothing to read from,
 * there is no channel left for a cart to travel down.
 */

export type CartLine = {
  key: string
  medicationId: number | null
  variantId?: number | null
  name: string
  variantLabel?: string
  /** What is being CHARGED — this is what the customer pays. */
  unitPrice: string
  /**
   * The catalogue price when the line was added, kept only so an override can
   * be recognised later. Set on every line; the sale records it ONLY when it
   * differs from unitPrice.
   */
  basePrice?: string
  quantity: number
}

export type CartVariant = {
  id: number
  label: string
  price: number | string
}

export type Cart = {
  id: string
  /**
   * The idempotency key for THIS cart's checkout, minted when the cart is
   * created and stable for its whole life.
   *
   * It must not be minted per attempt. A cashier on a weak line presses Enter,
   * sees nothing happen, and presses the button — two POSTs. If each carried
   * its own client_uuid the server would treat them as two different sales and
   * record both: stock down twice, and on a credit sale two debts against the
   * customer. Sharing one key lets the server's unique(store, client_uuid)
   * constraint collapse them into a single sale and return the winner.
   *
   * The cart is closed after a successful checkout, so the next sale gets a
   * fresh cart and a fresh key — a retry is deduplicated, a genuine second
   * sale is not.
   */
  saleUuid?: string
  /** The number printed as a barcode on this cart's receipt. Minted with the
   *  idempotency uuid so an offline receipt and the synced sale agree. */
  receiptCode?: string
  customerId: number | null
  customerName: string
  payment: "cash" | "debt"
  /** Return mode (إرجاع): stock goes back and the amount is refunded. */
  isReturn?: boolean
  /**
   * The id of the sale this cart is CORRECTING, if any.
   *
   * A cart with this set does not create a sale on checkout — it PATCHes that
   * one, keeping its receipt number, its place in the day, and its customer,
   * while the server files the previous version away. Absent on every ordinary
   * cart, which is the normal case.
   *
   * It lives on the cart (not in a ref or the URL) so it survives parking,
   * a reload, and the cross-device sync — the same way everything else the
   * cashier has half-finished does. A correction abandoned on the till at
   * closing time is still a correction when the shop opens.
   */
  editingSaleId?: number
  /** The receipt number of the sale being corrected — shown, never sent. */
  editingReceipt?: string
  /** Total-after-discount. Defaults to the cart total until the cashier
   *  edits it (tracked by `discountTouched`). */
  discounted: string
  discountTouched?: boolean
  /**
   * The pinned amount came from the sale being CORRECTED, not from the
   * cashier typing it now.
   *
   * It has to survive an edit that changes nothing — reopening a ₪90-on-₪100
   * invoice to fix a name must not silently re-charge the full ₪100. But it
   * must NOT survive a change to the lines: a ₪10 amount agreed for one item
   * is not the amount for that item plus eight more, and pinning it there
   * charged ₪10 for ₪121 of goods with nothing on screen to say so.
   */
  discountFromOriginal?: boolean
  /** Line sum when the correction was opened — how we know the lines moved. */
  editingBaseTotal?: number
  lines: CartLine[]
}

// Per-account storage so switching users on the same device never bleeds
// one account's carts into another's.
function storageKey(): string {
  return `alrahmah_pos_carts_v3:${convexAccountId()}`
}

/**
 * A correction cart NEVER leaves this browser session.
 *
 * Ordinary carts are parked work: a customer walks in mid-sale, you park the
 * basket and come back to it, maybe from the other till. Syncing those earns
 * its keep.
 *
 * A correction — a cart opened from the pencil on an existing sale — is
 * nothing like that. It is opened at one machine, from the sales page, and
 * saved a minute later at that same machine. Persisting it bought nothing and
 * cost plenty: any stale snapshot could resurrect one the cashier had already
 * closed, it appeared on the other till as a basket nobody there created, and
 * failed attempts piled up with no way to clear them. Closing one and finding
 * it back after a refresh is the same bug wearing a different hat.
 *
 * So corrections live in memory for the session that opened them, and every
 * saved copy — localStorage, the server, Convex — is written WITHOUT them. If
 * the page is refreshed mid-correction it is simply gone; the sale is
 * untouched and the pencil is one tap away. That is a far better failure than
 * a ghost basket nobody can get rid of.
 */
function persistable(carts: Cart[]): Cart[] {
  return carts.filter((c) => c.editingSaleId == null)
}

let seq = 0
function freshCart(): Cart {
  seq += 1
  return {
    id: `c${Date.now()}_${seq}`,
    saleUuid: uuid(),
    customerId: null,
    customerName: "",
    payment: "cash",
    isReturn: false,
    discounted: "",
    lines: [],
  }
}

export function cartTotal(cart: Cart): number {
  return cart.lines.reduce(
    (s, l) => s + toNumber(l.unitPrice) * l.quantity,
    0,
  )
}

/**
 * A saved cart blob, in this browser's localStorage.
 *
 * `accountId` is stamped on every write and CHECKED on every read.
 *
 * Nothing in this payload used to say whose carts these were. The storage key,
 * the server row, the Convex document and the cache key are each scoped by
 * account — but a blob that carries no identity of its own cannot be checked
 * once it has been handed over, so a leak in ANY of those layers puts another
 * cashier's open carts on this till silently, and the first sign of it is a
 * stranger's basket appearing mid-sale. Stamping identity into the payload
 * makes the till able to refuse what is not its own, whichever layer went
 * wrong.
 */
type SavedState = {
  carts?: Cart[]
  activeId?: string
  savedAt?: number
  accountId?: string
}

/**
 * Is this blob ours? Two answers, because the two sources differ in what they
 * can be trusted to have got right.
 *
 * LOCAL (this browser's localStorage) is read back from a key that already
 * contains the account id, so an unstamped blob there is simply an older save
 * by this same user. Accepting it means nobody loses parked carts the day the
 * stamp ships.
 *
 * REMOTE (the server row, the realtime push) is the path that actually went
 * wrong — carts arriving from another account. Anything unstamped over that
 * path is refused: it is either a pre-stamp copy, which the device that owns
 * it will re-send stamped within a shift, or it is the leak. The cost of
 * refusing is that one stale parked cart may not sync for a cycle. The cost of
 * accepting is another cashier's basket on this till, mid-sale.
 */
function isMineLocal(state: { accountId?: string } | null | undefined): boolean {
  const id = state?.accountId
  return !id || id === convexAccountId()
}


export function usePosCarts() {
  const [carts, setCarts] = useState<Cart[]>([])
  const [activeId, setActiveId] = useState<string>("")
  // The line most recently added/incremented, plus a monotonic tick so the UI
  // can re-focus its quantity field even when the SAME line is added twice.
  const [lastAdded, setLastAdded] = useState<{ key: string; tick: number }>({
    key: "",
    tick: 0,
  })
  const hydrated = useRef(false)

  // Live mirrors so imperative actions (close/clear) can read current state
  // and push a definitive copy to the server without waiting for the effect.
  const cartsRef = useRef<Cart[]>([])
  cartsRef.current = carts
  const activeIdRef = useRef("")
  activeIdRef.current = activeId


  // Hydrate from THIS browser, and nowhere else.
  useEffect(() => {
    let localSavedAt = 0
    try {
      const raw = window.localStorage.getItem(storageKey())
      if (raw) {
        const data = JSON.parse(raw) as SavedState & {
          carts: Cart[]
          activeId: string
        }
        if (
          isMineLocal(data) &&
          Array.isArray(data.carts) &&
          data.carts.length > 0
        ) {
          localSavedAt = data.savedAt ?? 0
          skipPush.current = true // hydration isn't a user change — no write
          setCarts(data.carts)
          setActiveId(
            data.carts.some((c) => c.id === data.activeId)
              ? data.activeId
              : data.carts[0].id,
          )
        }
      }
    } catch {
      /* corrupted storage — start clean */
    }
    if (!localSavedAt) {
      const c = freshCart()
      setCarts([c])
      setActiveId(c.id)
    }
    hydrated.current = true
  }, [])

  // Persist to THIS browser, and nowhere else.
  const skipPush = useRef(false)
  useEffect(() => {
    if (!hydrated.current || carts.length === 0) return
    if (skipPush.current) {
      skipPush.current = false
      return
    }
    try {
      window.localStorage.setItem(
        storageKey(),
        JSON.stringify({
          // Corrections are never written down at all — see persistable().
          carts: persistable(carts),
          activeId,
          savedAt: Date.now(),
          accountId: convexAccountId(),
        }),
      )
    } catch {
      /* private mode / quota — carts still live in memory for this session */
    }
  }, [carts, activeId])

  /** Push a state to the server RIGHT NOW (localStorage + Convex + Django),
   *  no debounce. Used when the cashier deletes/clears a cart so the emptied
   *  cart definitively overwrites the saved server copy — otherwise it would
   *  re-hydrate on the next login. */
  /**
   * Write the given state immediately instead of waiting for the effect.
   *
   * Used when a cart is closed or cleared, so the removal is on disk before
   * anything else can read the old copy back.
   */
  const flushNow = useCallback((nextCarts: Cart[], nextActiveId: string) => {
    skipPush.current = true // the effect must not also write this same state
    try {
      window.localStorage.setItem(
        storageKey(),
        JSON.stringify({
          carts: persistable(nextCarts),
          activeId: nextActiveId,
          savedAt: Date.now(),
          accountId: convexAccountId(),
        }),
      )
    } catch {
      /* private mode / quota */
    }
  }, [])

  const active = carts.find((c) => c.id === activeId) ?? carts[0]

  const patchActive = useCallback(
    (patch: Partial<Cart> | ((c: Cart) => Partial<Cart>)) => {
      setCarts((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) }
            : c,
        ),
      )
    },
    [activeId],
  )

  /**
   * The active cart's idempotency key, minting one if it predates this field
   * (carts restored from localStorage or the server copy after an upgrade).
   *
   * Returns synchronously because checkout needs it in the same tick; the
   * setCarts call just persists it for the next attempt. Two attempts in the
   * same tick therefore share the value we return here, which is the whole
   * point.
   */
  const ensureSaleUuid = useCallback((): string => {
    const cart = cartsRef.current.find((c) => c.id === activeIdRef.current)
    if (cart?.saleUuid) return cart.saleUuid
    const minted = uuid()
    if (cart) {
      setCarts((prev) =>
        prev.map((c) => (c.id === cart.id ? { ...c, saleUuid: minted } : c)),
      )
    }
    return minted
  }, [])

  /**
   * The receipt number for THIS cart — same contract as the uuid above: minted
   * once, reused by every attempt. It has to be stable because the paper may
   * already be in the customer's hand (an offline sale prints before it syncs)
   * and a second attempt must not hand the server a different number.
   */
  const ensureReceiptCode = useCallback((): string => {
    const cart = cartsRef.current.find((c) => c.id === activeIdRef.current)
    if (cart?.receiptCode) return cart.receiptCode
    const minted = newReceiptCode()
    if (cart) {
      setCarts((prev) =>
        prev.map((c) => (c.id === cart.id ? { ...c, receiptCode: minted } : c)),
      )
    }
    return minted
  }, [])

  const addMedication = useCallback(
    (med: Product, variant?: CartVariant | null) => {
      const variantId = variant?.id ?? null
      // Resolve the affected line key up front (from the live mirror) so we can
      // point the quantity auto-focus at it — whether we increment an existing
      // line or append a new one.
      const cart =
        cartsRef.current.find((c) => c.id === activeIdRef.current) ??
        cartsRef.current[0]
      const existingKey = cart?.lines.find(
        (l) => l.medicationId === med.id && (l.variantId ?? null) === variantId,
      )?.key
      const key = existingKey ?? `l${Date.now()}_${(seq += 1)}`
      patchActive((c) => {
        const existing = c.lines.find(
          (l) =>
            l.medicationId === med.id && (l.variantId ?? null) === variantId,
        )
        if (existing) {
          return {
            lines: c.lines.map((l) =>
              l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
            ),
          }
        }
        return {
          lines: [
            ...c.lines,
            {
              key,
              medicationId: med.id,
              variantId,
              name: med.name ?? "",
              variantLabel: variant?.label ?? "",
              unitPrice: variant ? String(variant.price) : med.price ?? "0",
              basePrice: variant ? String(variant.price) : med.price ?? "0",
              quantity: 1,
            },
          ],
        }
      })
      setLastAdded((p) => ({ key, tick: p.tick + 1 }))
    },
    [patchActive],
  )

  /**
   * Switch a line between the loose piece and one of the product's pack
   * units, in place.
   *
   * The POS adds every product as a single PIECE, always — the packs the
   * Shamel import created (عبوة ×24 and friends) are a secondary selling unit,
   * not a required choice, and forcing the cashier to answer "which one?" on a
   * chocolate bar that costs ₪1 is wrong far more often than it is right. This
   * is the escape hatch for the times it IS a whole box.
   *
   * The quantity is preserved: 3 pieces → 3 boxes, not 3 pieces of a box. The
   * line key stays the same so nothing re-renders or loses focus.
   */
  const setLineUnit = useCallback(
    (key: string, variant: CartVariant | null, basePrice: string | number) => {
      patchActive((c) => ({
        lines: c.lines.map((l) =>
          l.key === key
            ? {
                ...l,
                variantId: variant?.id ?? null,
                variantLabel: variant?.label ?? "",
                unitPrice: variant ? String(variant.price) : String(basePrice),
                // Changing the unit re-bases the price: a box at its own list
                // price is not "an overridden piece price".
                basePrice: variant ? String(variant.price) : String(basePrice),
              }
            : l,
        ),
      }))
    },
    [patchActive],
  )

  /**
   * Set a line's CHARGED price, from the cashier editing the line total.
   *
   * They type into المجموع — the money the customer hands over for that line —
   * because that is the number being negotiated ("make it 10 for the two").
   * The unit price is derived from it. `basePrice` is left alone: it is the
   * evidence that this was an override, and the sale sends it as
   * `original_unit_price` so the owner can see what was given away.
   */
  const setLinePrice = useCallback(
    (key: string, unitPrice: number) => {
      patchActive((c) => ({
        lines: c.lines.map((l) =>
          l.key === key ? { ...l, unitPrice: unitPrice.toFixed(2) } : l,
        ),
      }))
    },
    [patchActive],
  )

  /** Set a line's total directly; quantity is held, unit price follows. */
  const setLineTotal = useCallback(
    (key: string, lineTotal: number) => {
      patchActive((c) => ({
        lines: c.lines.map((l) => {
          if (l.key !== key) return l
          const qty = l.quantity || 1
          return { ...l, unitPrice: (lineTotal / qty).toFixed(2) }
        }),
      }))
    },
    [patchActive],
  )

  /**
   * Add a FREE-TEXT line: a name and a price, with no catalogue product.
   *
   * Mobile top-up is the case — it has no barcode to scan and no stock to
   * decrement, and creating a catalogue row per network per amount would be
   * worse than useless. The sale API accepts a line with `medication_name` +
   * `unit_price` instead of a product id, so these ring up, print and report
   * exactly like anything else.
   *
   * Always a NEW line, never merged: two ₪10 top-ups are two cards, and the
   * cashier needs to see both.
   */
  const addFreeItem = useCallback(
    (name: string, unitPrice: number, quantity = 1) => {
      const key = `f${Date.now()}_${(seq += 1)}`
      // Guard the two values that reach the receipt. A blank name would print
      // an empty line and a negative price would pay the customer.
      const label = name.trim() || "صنف"
      const price = Number.isFinite(unitPrice) ? Math.max(unitPrice, 0) : 0
      const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
      patchActive((c) => ({
        lines: [
          ...c.lines,
          {
            key,
            medicationId: null,
            variantId: null,
            name: label,
            unitPrice: price.toFixed(2),
            basePrice: price.toFixed(2),
            quantity: qty,
          },
        ],
      }))
      setLastAdded((p) => ({ key, tick: p.tick + 1 }))
    },
    [patchActive],
  )

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      patchActive((c) => ({
        lines:
          quantity <= 0
            ? c.lines.filter((l) => l.key !== key)
            : c.lines.map((l) => (l.key === key ? { ...l, quantity } : l)),
      }))
    },
    [patchActive],
  )

  const removeLine = useCallback(
    (key: string) => {
      patchActive((c) => ({ lines: c.lines.filter((l) => l.key !== key) }))
    },
    [patchActive],
  )

  /** Park the current sale and open a new empty cart. */
  const parkAndNew = useCallback(() => {
    const c = freshCart()
    setCarts((prev) => [...prev, c])
    setActiveId(c.id)
  }, [])

  /**
   * Open a cart that CORRECTS an existing sale.
   *
   * Re-entering the same sale twice must not open two carts: the cashier taps
   * the pencil, gets distracted, taps it again, and would otherwise be editing
   * one invoice from two baskets with only the last save surviving. So an
   * existing cart for the same sale is reused and simply brought to the front.
   */
  const openSaleForEdit = useCallback(
    (sale: {
      id: number
      receiptCode?: string
      customerId?: number | null
      customerName?: string
      payment?: "cash" | "debt"
      isReturn?: boolean
      discounted?: string
      lines: CartLine[]
    }) => {
      // Match on the SALE alone, not on whether this page-load opened it.
      //
      // myEditCarts is per page-load, so gating the reuse on it meant a
      // correction that survived a reload — or came back from the server —
      // was invisible here, and tapping the pencil on that same sale opened a
      // SECOND cart for it. Do that a few times and the till carries three
      // corrections of three sales, none of them clearing, which is exactly
      // what it looked like.
      const existing = cartsRef.current.find((c) => c.editingSaleId === sale.id)
      if (existing) {
        setActiveId(existing.id)
        return existing.id
      }
      const c: Cart = {
        ...freshCart(),
        editingSaleId: sale.id,
        editingReceipt: sale.receiptCode || "",
        customerId: sale.customerId ?? null,
        customerName: sale.customerName ?? "",
        payment: sale.payment ?? "cash",
        isReturn: Boolean(sale.isReturn),
        discounted: sale.discounted ?? "",
        discountTouched: Boolean(sale.discounted),
        discountFromOriginal: Boolean(sale.discounted),
        editingBaseTotal: sale.lines.reduce(
          (sum, l) => sum + toNumber(l.unitPrice) * l.quantity,
          0,
        ),
        lines: sale.lines,
      }
      const next = [...cartsRef.current, c]
      setCarts(next)
      setActiveId(c.id)
      // Commit RIGHT NOW rather than waiting for the debounced push.
      //
      // The server copy of the carts is fetched when the POS mounts — before
      // the cashier taps the pencil. It lands a moment later and replaces the
      // whole list, which would delete this cart while she is looking at it.
      // flushNow stamps a newer savedAt, so that in-flight snapshot loses on
      // arrival instead of winning. Same reason closeCart flushes.
      flushNow(next, c.id)
      return c.id
    },
    [flushNow],
  )

  /** Drop a cart (after checkout or cancel). Always keeps one cart open.
   *  The result is flushed to the server immediately so a deleted cart never
   *  comes back on the next login. */
  const closeCart = useCallback(
    (id: string) => {
      const rest = cartsRef.current.filter((c) => c.id !== id)
      const next = rest.length > 0 ? rest : [freshCart()]
      const nextActiveId =
        rest.length > 0
          ? activeIdRef.current === id
            ? rest[rest.length - 1].id
            : activeIdRef.current
          : next[0].id
      setCarts(next)
      setActiveId(nextActiveId)
      flushNow(next, nextActiveId)
    },
    [flushNow],
  )

  /** Hard reset: wipe every cart to a single empty one and clear the server
   *  copy immediately. */
  const clearAll = useCallback(() => {
    const c = freshCart()
    setCarts([c])
    setActiveId(c.id)
    flushNow([c], c.id)
  }, [flushNow])

  /** PREVENTION: drop any line whose product no longer exists for this store
   *  (a re-imported/deleted id, or a legacy stale line) across EVERY cart, and
   *  persist the cleaned state everywhere so the dead line can't re-hydrate from
   *  local/server/Convex. Callers pass a validity test built from the FRESH
   *  catalogue. Returns how many lines were removed. */
  const reconcile = useCallback(
    (isValid: (medId: number) => boolean): number => {
      const cur = cartsRef.current
      let removed = 0
      const next = cur.map((c) => {
        const kept = c.lines.filter(
          (l) => l.medicationId == null || isValid(l.medicationId),
        )
        removed += c.lines.length - kept.length
        return kept.length === c.lines.length ? c : { ...c, lines: kept }
      })
      if (removed > 0) {
        setCarts(next)
        flushNow(next, activeIdRef.current)
      }
      return removed
    },
    [flushNow],
  )

  return {
    carts,
    active,
    activeId,
    setActiveId,
    patchActive,
    ensureSaleUuid,
    ensureReceiptCode,
    addMedication,
    addFreeItem,
    setQuantity,
    setLineUnit,
    setLinePrice,
    setLineTotal,
    removeLine,
    parkAndNew,
    openSaleForEdit,
    closeCart,
    clearAll,
    reconcile,
    /** Key of the line last added/incremented (for quantity auto-focus). */
    lastAddedKey: lastAdded.key,
    /** Bumps on every add so the same line can be re-focused. */
    addTick: lastAdded.tick,
  }
}
