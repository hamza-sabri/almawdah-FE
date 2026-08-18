"use client"

import { useEffect, useRef } from "react"

/**
 * Global keyboard-wedge listener: a hardware barcode scanner "types" the code
 * as a fast keystroke burst ending in Enter. This captures that burst anywhere
 * on the page — the cashier never has to click into the search box first.
 *
 * It stays out of the way of normal typing:
 *  - if the user is focused in a text field (search box, a form input, a
 *    textarea), the field handles the keys itself and we do nothing;
 *  - only FAST bursts (scanner speed) that end in Enter fire the callback, so
 *    ordinary key presses on the page never trigger it.
 */
export function useGlobalScanner(
  onScan: (code: string) => void,
  {
    enabled = true,
    minLength = 3,
    // Max ms between keystrokes to still count as one scan. Hardware scanners
    // emit ~10-30ms apart; human typing is far slower.
    maxGapMs = 80,
    // Fired on a LONE Enter/Return (no scan burst in progress, no field
    // focused) — the POS uses it as "complete the sale".
    onEnter,
    // + / − with nothing focused: nudge the last added line's quantity.
    onAdjustQty,
    // Shift + numpad-plus: park the current cart and open a new one.
    onNewCart,
    // A digit typed with nothing focused and no burst under way. The cashier
    // has just scanned or tapped an item and is now typing "3" for three of
    // them — so jump into that line's quantity field, seeded with the digit.
    // The seed matters: without it the first character is swallowed by the
    // focus change, and a barcode that arrives this way loses its first digit.
    onDigit,
  }: {
    enabled?: boolean
    minLength?: number
    maxGapMs?: number
    onEnter?: () => void
    onAdjustQty?: (delta: number) => void
    onNewCart?: () => void
    onDigit?: (digit: string) => void
  } = {},
) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter
  const onAdjustQtyRef = useRef(onAdjustQty)
  onAdjustQtyRef.current = onAdjustQty
  const onNewCartRef = useRef(onNewCart)
  onNewCartRef.current = onNewCart
  const onDigitRef = useRef(onDigit)
  onDigitRef.current = onDigit

  useEffect(() => {
    if (!enabled) return
    let buffer = ""
    let lastTime = 0
    // A digit waiting to be classified. We cannot tell a human typing "3" from
    // the first character of a scanner burst at the moment the key lands — so
    // we hold it, and only hand it to onDigit once an idle gap proves nobody
    // is still typing. Handing it over immediately looked fine on a loaded
    // cart (the quantity field has its own burst detection and would have
    // recovered) but silently ate the first digit of every scan made on an
    // EMPTY cart, where there is no field to hand off to.
    let digitTimer: ReturnType<typeof setTimeout> | null = null
    const cancelDigit = () => {
      if (digitTimer !== null) {
        clearTimeout(digitTimer)
        digitTimer = null
      }
    }

    function isEditable(el: Element | null): boolean {
      if (!el) return false
      const node = el as HTMLElement
      const tag = node.tagName
      return (
        node.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      )
    }

    function onKeyDown(e: KeyboardEvent) {
      // Let real shortcuts and modified keys through untouched.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // If a field is focused, it owns the keystrokes (manual entry / the
      // search bar's own scan handling).
      if (isEditable(document.activeElement)) {
        cancelDigit()
        buffer = ""
        return
      }

      const now = Date.now()
      if (e.key === "Enter") {
        cancelDigit()
        if (buffer.length >= minLength) {
          e.preventDefault()
          onScanRef.current(buffer)
        } else if (buffer.length === 0) {
          // Nothing was being scanned and no field is focused → treat a bare
          // Enter as "complete the sale". A scanner's own trailing Enter never
          // reaches here: its burst leaves buffer.length >= minLength above.
          onEnterRef.current?.()
        }
        buffer = ""
        return
      }
      // ── quantity nudges ────────────────────────────────────────────
      // Layout note: on most keyboards main-row "+" is Shift+"=", so shiftKey
      // is true for it and cannot distinguish intent. The numpad is the one
      // place "+" is unshifted, and it is what a till actually has — so
      // Shift + NUMPAD plus is the "new cart" gesture, and every other plus
      // increments.
      if (e.code === "NumpadAdd" && e.shiftKey) {
        e.preventDefault()
        cancelDigit()
        buffer = ""
        onNewCartRef.current?.()
        return
      }
      if (e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault()
        cancelDigit()
        buffer = ""
        onAdjustQtyRef.current?.(1)
        return
      }
      if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault()
        cancelDigit()
        buffer = ""
        onAdjustQtyRef.current?.(-1)
        return
      }

      if (e.key.length === 1) {
        const gap = now - lastTime
        // Any further keystroke means the digit we were holding was part of a
        // burst after all — drop the handoff and let the buffer run.
        cancelDigit()
        // A slow gap means it's a human tapping keys, not a scanner — restart.
        if (gap > maxGapMs) buffer = ""
        buffer += e.key
        lastTime = now

        // A single digit, alone, after an idle gap. If nothing follows within
        // one scanner-gap it is a human typing a quantity — a gun would have
        // delivered the whole code by then.
        if (buffer.length === 1 && /[0-9]/.test(e.key) && onDigitRef.current) {
          const digit = e.key
          digitTimer = setTimeout(() => {
            digitTimer = null
            if (buffer !== digit) return // something arrived after all
            buffer = ""
            onDigitRef.current?.(digit)
          }, maxGapMs + 20)
        }
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      cancelDigit()
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [enabled, minLength, maxGapMs])
}
