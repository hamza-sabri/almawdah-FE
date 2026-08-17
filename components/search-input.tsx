"use client"

import { useState } from "react"
import { ScanBarcode, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScanDialog, type ScanDetectResult } from "@/components/scan/scan-dialog"
import { cn } from "@/lib/utils"

export function SearchInput({
  value,
  onChange,
  placeholder = "بحث…",
  className,
  scan = false,
  onScan,
  scanContinuous = false,
  scanStatus,
  onEnter,
  onScanClick,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  /** Show a barcode-scan button inside the field (fills it with the code). */
  scan?: boolean
  /** Override what a successful scan does (default: fill the field). */
  onScan?: (code: string) => ScanDetectResult
  /** Keep the camera open between scans (POS multi-item mode). */
  scanContinuous?: boolean
  /** Live info rendered under the viewfinder while scanning. */
  scanStatus?: React.ReactNode
  /** Enter key (hardware barcode scanners "type" a code then Enter). */
  onEnter?: (value: string) => void
  /** Intercept the scan-button click; return true to skip the built-in dialog. */
  onScanClick?: () => boolean | void
}) {
  const [scanOpen, setScanOpen] = useState(false)

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter && value.trim()) {
            e.preventDefault()
            onEnter(value.trim())
          }
        }}
        placeholder={placeholder}
        className={cn(
          "h-11 rounded-full border-border bg-card ps-10 shadow-sm",
          scan ? "pe-20" : "pe-9",
        )}
        inputMode="search"
      />
      <div className="absolute inset-y-0 end-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="مسح البحث"
            className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        {scan && (
          <button
            type="button"
            onClick={() => {
              if (onScanClick && onScanClick()) return
              setScanOpen(true)
            }}
            aria-label="مسح باركود"
            className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/15"
          >
            <ScanBarcode className="size-4.5" />
          </button>
        )}
      </div>
      {scan && (
        <ScanDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onDetect={(code) => (onScan ? onScan(code) : onChange(code))}
          continuous={scanContinuous}
          statusBar={scanStatus}
        />
      )}
    </div>
  )
}
