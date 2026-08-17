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
  }: {
    enabled?: boolean
    minLength?: number
    maxGapMs?: number
    onEnter?: () => void
  } = {},
) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter

  useEffect(() => {
    if (!enabled) return
    let buffer = ""
    let lastTime = 0

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
        buffer = ""
        return
      }

      const now = Date.now()
      if (e.key === "Enter") {
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
      if (e.key.length === 1) {
        // A slow gap means it's a human tapping keys, not a scanner — restart.
        if (now - lastTime > maxGapMs) buffer = ""
        buffer += e.key
        lastTime = now
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [enabled, minLength, maxGapMs])
}
