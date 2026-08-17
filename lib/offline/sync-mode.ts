"use client"

/**
 * User-controlled sync policy. The app is offline-capable (local sale queue +
 * cached reads); this decides WHEN data moves in each direction — so a store
 * on a weak/expensive connection can hold sync, upload sales only, etc.
 *
 * Two independent valves:
 *   • Upload  (push queued sales/writes to the cloud)
 *   • Download(pull fresh prices/data from the cloud)
 * A manual "Sync now" always works regardless of mode.
 *
 * Correctness is unchanged by these toggles — they only gate timing. Cloud stays
 * the source of truth; queued sales are append-only and never overwritten.
 */

export type SyncMode = "auto" | "wifi" | "upload" | "download" | "manual" | "off"

export const SYNC_MODES: { value: SyncMode; label: string; hint: string }[] = [
  { value: "auto", label: "تلقائي", hint: "مزامنة كاملة تلقائياً — رفع وتنزيل" },
  { value: "wifi", label: "واي فاي / اتصال جيد فقط", hint: "تتم المزامنة فقط على اتصال جيد (يوفّر البيانات على الشبكات الضعيفة)" },
  { value: "upload", label: "رفع المبيعات فقط", hint: "ارفع فواتيرك للسحابة دون تنزيل تحديثات" },
  { value: "download", label: "تنزيل فقط", hint: "حدّث الأسعار والبيانات دون رفع" },
  { value: "manual", label: "يدوي", hint: "لا مزامنة تلقائية — استخدم زر «زامن الآن»" },
  { value: "off", label: "إيقاف المزامنة", hint: "اعمل دون اتصال تماماً — لا شيء يُزامَن حتى تعيد التشغيل" },
]

const KEY = "pharma_sync_mode"
const CHANGE_EVENT = "pharma-sync-mode-changed"
const VALID: SyncMode[] = ["auto", "wifi", "upload", "download", "manual", "off"]

export function getSyncMode(): SyncMode {
  if (typeof window === "undefined") return "auto"
  try {
    const v = window.localStorage.getItem(KEY) as SyncMode | null
    return v && VALID.includes(v) ? v : "auto"
  } catch {
    return "auto"
  }
}

export function setSyncMode(mode: SyncMode): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, mode)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    /* ignore */
  }
}

/** Subscribe to mode changes (this tab via the custom event, others via storage). */
export function onSyncModeChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

/**
 * Best-effort "good connection" check for the Wi-Fi mode. The Network
 * Information API can't reliably tell Wi-Fi from cellular on every device, so we
 * block only when we're fairly sure it's a metered/slow link (Save-Data on, a
 * known non-Wi-Fi type, or a slow effective type). Unknown → allow.
 */
function onGoodConnection(): boolean {
  try {
    const c = (navigator as unknown as { connection?: { saveData?: boolean; type?: string; effectiveType?: string } }).connection
    if (!c) return true
    if (c.saveData) return false
    if (typeof c.type === "string") return c.type === "wifi" || c.type === "ethernet"
    if (typeof c.effectiveType === "string") return c.effectiveType === "4g"
    return true
  } catch {
    return true
  }
}

/** May the app AUTO-push queued writes right now? (Manual "Sync now" ignores this.) */
export function canAutoUpload(): boolean {
  const m = getSyncMode()
  if (m === "off" || m === "manual" || m === "download") return false
  if (m === "wifi") return onGoodConnection()
  return true // auto, upload
}

/** May the app AUTO-pull fresh data right now? */
export function canAutoDownload(): boolean {
  const m = getSyncMode()
  if (m === "off" || m === "manual" || m === "upload") return false
  if (m === "wifi") return onGoodConnection()
  return true // auto, download
}

/**
 * A manual "Sync now" overrides the valves (so it does a full sync even in
 * Offline / Upload-only mode). The Settings screen wraps its sync in
 * begin/endManualSync; customFetch checks isManualSyncing() before serving a
 * cached read instead of hitting the network.
 */
let manualSyncing = false
export function beginManualSync(): void {
  manualSyncing = true
}
export function endManualSync(): void {
  manualSyncing = false
}
export function isManualSyncing(): boolean {
  return manualSyncing
}
