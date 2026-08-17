"use client"

import { useEffect } from "react"

import { useModules } from "@/lib/modules"
import { setOfflineEnabled } from "@/lib/offline/enabled"

/**
 * Keeps the localStorage offline flag in sync with the account's modules, so
 * the sale-submit path can gate offline behaviour synchronously. Mount once in
 * the app shell. Renders nothing.
 */
export function OfflineGate() {
  const { modules } = useModules()
  useEffect(() => {
    // null = unknown / legacy backend → don't lock anyone out.
    setOfflineEnabled(modules === null || modules.has("offline"))
  }, [modules])
  return null
}
