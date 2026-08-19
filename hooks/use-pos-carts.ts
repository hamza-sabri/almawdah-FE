"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Product } from "@/api/generated/model"
import { cartStateGet, cartStatePut } from "@/api/sales"
import { cartsApi, convexAccountId, getConvex } from "@/lib/convex"
import { toNumber } from "@/lib/format"
import { uuid } from "@/lib/offline/queue"
import { newReceiptCode } from "@/lib/receipt-code"

/**
 * POS carts with parking: several sales can be open at once (a customer walks
 * in mid-sale → park the current cart, serve them, come back). Everything is
 * mirrored to localStorage AND synced per-account to the server, so a sale
 * started on one machine can be finished on another.
 *
 * Realtime: when Convex is configured (NEXT_PUBLIC_CONVEX_URL) every device
 * on the account subscribes to the cart document — scan an item on the phone
 * and it appears on the desktop instantly, no refresh. Without Convex the
 * old sync-on-load behaviour still works.
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
 * A saved cart blob.
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
type RemoteState = {
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

function isMineRemote(state: { accountId?: string } | null | undefined): boolean {
  const me = convexAccountId()
  // "anon" means this device could not read its own token. It must never be
  // treated as an identity that matches anything.
  if (!me || me === "anon") return false
  return state?.accountId === me
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
  // True once we've READ the server's copy. Until then we never WRITE to the
  // server — otherwise the first-render placeholder cart (or a cosmetic
  // change like the auto-filled discount) would clobber a real saved cart
  // before we've even seen it, and it would re-appear on the next login.
  const serverHydrated = useRef(false)
  // Timestamp of the newest state this device has seen (local or remote) —
  // used to ignore stale snapshots and our own echoes from the subscription.
  const lastSavedAt = useRef(0)

  // Live mirrors so imperative actions (close/clear) can read current state
  // and push a definitive copy to the server without waiting for the effect.
  const cartsRef = useRef<Cart[]>([])
  cartsRef.current = carts
  const activeIdRef = useRef("")
  activeIdRef.current = activeId

  /**
   * Ids of correction carts THIS device opened, this session.
   *
   * The rescue below protects them from being wiped by an in-flight server
   * snapshot. It must be a closed list, not "any cart that looks like an
   * edit": a foreign edit cart arriving from somewhere else would otherwise be
   * rescued on every sync and could never be cleared, so several strangers'
   * corrections pile up on one till and none of them go away.
   */
  const myEditCarts = useRef<Set<string>>(new Set())

  const applyRemote = useCallback((remote: RemoteState) => {
    // Checked HERE too, not only at each call site: this is the one function
    // that can replace what is on the till, so it is the one place the rule
    // must not be possible to forget.
    if (!isMineRemote(remote)) return
    if (!Array.isArray(remote.carts) || remote.carts.length === 0) return
    skipPush.current = true // don't echo the received state back
    const incoming = remote.carts

    // A CORRECTION opened on this device moments ago cannot be in the remote
    // snapshot — that was fetched before the cashier tapped the pencil.
    // Replacing the array wholesale would delete it while she was looking at
    // it, and the sale would simply never open.
    //
    // ONLY corrections are rescued, deliberately: an ordinary cart missing
    // from the remote copy usually means another till closed it, and bringing
    // those back would undo that.
    const rescued = cartsRef.current.filter(
      (c) =>
        c.editingSaleId != null &&
        myEditCarts.current.has(c.id) &&
        !incoming.some((r) => r.id === c.id),
    )
    setCarts(rescued.length > 0 ? [...incoming, ...rescued] : incoming)
    setActiveId((cur) =>
      // Mid-edit keeps the focus.
      rescued.some((c) => c.id === cur)
        ? cur
        : incoming.some((c) => c.id === cur)
          ? cur
          : incoming.some((c) => c.id === remote.activeId)
            ? remote.activeId!
            : incoming[0].id,
    )
  }, [])

  // Hydrate: localStorage first (instant), then the server copy wins when
  // it's newer (sale started on another machine).
  useEffect(() => {
    let localSavedAt = 0
    try {
      const raw = window.localStorage.getItem(storageKey())
      if (raw) {
        const data = JSON.parse(raw) as RemoteState & {
          carts: Cart[]
          activeId: string
        }
        if (
          isMineLocal(data) &&
          Array.isArray(data.carts) &&
          data.carts.length > 0
        ) {
          localSavedAt = data.savedAt ?? 0
          lastSavedAt.current = localSavedAt
          skipPush.current = true // hydration isn't a user change — no push
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
      skipPush.current = true // an empty starter cart must never clobber the server
      setCarts([c])
      setActiveId(c.id)
    }
    hydrated.current = true

    // Safety: if the server never answers, unblock writes after 5s so the
    // cashier isn't stuck unable to save.
    const unblock = window.setTimeout(() => {
      serverHydrated.current = true
    }, 5000)

    void cartStateGet()
      .then((res) => {
        const remote = res.data.data as unknown as RemoteState
        // Somebody else's carts. Whatever handed them to us — a shared cache,
        // a stale row, a proxy — the till must not open them.
        if (!isMineRemote(remote)) return
        if (remote && (remote.savedAt ?? 0) > lastSavedAt.current) {
          lastSavedAt.current = remote.savedAt ?? 0
          applyRemote(remote)
        }
      })
      .catch(() => {
        /* offline — local copy is fine */
      })
      .finally(() => {
        window.clearTimeout(unblock)
        serverHydrated.current = true
      })
  }, [applyRemote])

  // Realtime: live subscription to this account's cart document. Convex
  // pushes every change — add an item on one device, it renders on all the
  // others within a heartbeat.
  useEffect(() => {
    const convex = getConvex()
    if (!convex) return
    const unsubscribe = convex.onUpdate(
      cartsApi.get,
      { accountId: convexAccountId() },
      (doc) => {
        const row = doc as { data?: RemoteState; savedAt?: number } | null
        if (!row?.data) return
        // Before lastSavedAt is touched: letting a foreign blob move that
        // watermark would ALSO block the next legitimate update from this
        // account, turning a leak into a silent desync.
        if (!isMineRemote(row.data)) return
        const savedAt = row.savedAt ?? row.data.savedAt ?? 0
        if (savedAt <= lastSavedAt.current) return // stale or our own echo
        lastSavedAt.current = savedAt
        applyRemote(row.data)
      },
      () => {
        /* subscription error — polling-free fallback still applies on load */
      },
    )
    return unsubscribe
  }, [applyRemote])

  // Persist on every change: localStorage immediately, Convex almost
  // immediately (that's the realtime broadcast), Django/Postgres debounced
  // as the durable copy.
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const livePushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipPush = useRef(false)
  useEffect(() => {
    if (!hydrated.current || carts.length === 0) return
    if (skipPush.current) {
      // State came from hydration or another device — mirror it locally with
      // its TRUE timestamp (re-stamping would make stale data look fresh and
      // block newer server copies from ever applying).
      skipPush.current = false
      try {
        window.localStorage.setItem(
          storageKey(),
          JSON.stringify({
            carts: persistable(carts),
            activeId,
            savedAt: lastSavedAt.current,
            accountId: convexAccountId(),
          }),
        )
      } catch {
        /* storage full — carts still live in memory */
      }
      return
    }
    if (!serverHydrated.current) {
      // A local change before we've read the server copy — mirror locally but
      // do NOT write to the server yet, and keep the current savedAt so an
      // incoming server copy can still win.
      try {
        window.localStorage.setItem(
          storageKey(),
          JSON.stringify({
            carts: persistable(carts),
            activeId,
            savedAt: lastSavedAt.current,
            accountId: convexAccountId(),
          }),
        )
      } catch {
        /* storage full */
      }
      return
    }
    const savedAt = Date.now()
    const keep = persistable(carts)
    // Every cart on screen is a correction, so there is nothing to save. Do
    // NOT write an empty list to the server: another till may have a genuinely
    // parked basket, and an empty list is last-write-wins over it.
    if (keep.length === 0) return
    const payload = {
      carts: keep,
      activeId,
      savedAt,
      accountId: convexAccountId(),
    }
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(payload))
    } catch {
      /* storage full — carts still live in memory */
    }
    lastSavedAt.current = savedAt
    const convex = getConvex()
    if (convex) {
      if (livePushTimer.current) clearTimeout(livePushTimer.current)
      livePushTimer.current = setTimeout(() => {
        void convex
          .mutation(cartsApi.put, {
            accountId: convexAccountId(),
            data: payload,
            savedAt,
          })
          .catch(() => {
            /* offline — Django sync below still covers durability */
          })
      }, 250)
    }
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      void cartStatePut(payload as unknown as Record<string, unknown>).catch(
        () => {
          /* offline — will sync on the next change */
        },
      )
    }, 1500)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
      if (livePushTimer.current) clearTimeout(livePushTimer.current)
    }
  }, [carts, activeId])

  /** Push a state to the server RIGHT NOW (localStorage + Convex + Django),
   *  no debounce. Used when the cashier deletes/clears a cart so the emptied
   *  cart definitively overwrites the saved server copy — otherwise it would
   *  re-hydrate on the next login. */
  const flushNow = useCallback((nextCarts: Cart[], nextActiveId: string) => {
    const savedAt = Date.now()
    lastSavedAt.current = savedAt
    serverHydrated.current = true // an explicit clear commits to the server
    skipPush.current = true // the effect must not also push this same state
    const keep = persistable(nextCarts)
    // Same reason as the debounced push: an all-corrections list is not an
    // instruction to clear the other till.
    if (keep.length === 0) return
    const payload = {
      carts: keep,
      activeId: nextActiveId,
      savedAt,
      accountId: convexAccountId(),
    }
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(payload))
    } catch {
      /* storage full — state still lives in memory */
    }
    const convex = getConvex()
    if (convex) {
      void convex
        .mutation(cartsApi.put, {
          accountId: convexAccountId(),
          data: payload,
          savedAt,
        })
        .catch(() => {})
    }
    void cartStatePut(payload as unknown as Record<string, unknown>).catch(
      () => {},
    )
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
        // Adopt it, so the rescue in applyRemote protects it from here on.
        myEditCarts.current.add(existing.id)
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
        lines: sale.lines,
      }
      myEditCarts.current.add(c.id)
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
      myEditCarts.current.delete(id)
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
