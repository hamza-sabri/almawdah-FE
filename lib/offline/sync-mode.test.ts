import { describe, it, expect, beforeEach } from "vitest"
import {
  getSyncMode,
  setSyncMode,
  canAutoUpload,
  canAutoDownload,
  beginManualSync,
  endManualSync,
  isManualSyncing,
} from "@/lib/offline/sync-mode"

describe("sync modes gate the two valves (upload / download)", () => {
  beforeEach(() => window.localStorage.clear())

  it("defaults to auto with both valves open", () => {
    expect(getSyncMode()).toBe("auto")
    expect(canAutoUpload()).toBe(true)
    expect(canAutoDownload()).toBe(true)
  })

  it("off closes both", () => {
    setSyncMode("off")
    expect(canAutoUpload()).toBe(false)
    expect(canAutoDownload()).toBe(false)
  })

  it("upload-only opens upload, closes download", () => {
    setSyncMode("upload")
    expect(canAutoUpload()).toBe(true)
    expect(canAutoDownload()).toBe(false)
  })

  it("download-only opens download, closes upload", () => {
    setSyncMode("download")
    expect(canAutoUpload()).toBe(false)
    expect(canAutoDownload()).toBe(true)
  })

  it("manual closes both auto valves (manual Sync now bypasses separately)", () => {
    setSyncMode("manual")
    expect(canAutoUpload()).toBe(false)
    expect(canAutoDownload()).toBe(false)
  })

  it("wifi mode allows sync when the connection type is unknown (jsdom)", () => {
    setSyncMode("wifi")
    expect(canAutoUpload()).toBe(true)
    expect(canAutoDownload()).toBe(true)
  })

  it("persists the chosen mode", () => {
    setSyncMode("upload")
    expect(getSyncMode()).toBe("upload")
  })

  it("manual-sync override toggles (lets 'Sync now' force a full sync)", () => {
    expect(isManualSyncing()).toBe(false)
    beginManualSync()
    expect(isManualSyncing()).toBe(true)
    endManualSync()
    expect(isManualSyncing()).toBe(false)
  })
})
