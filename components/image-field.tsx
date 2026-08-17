"use client"

import { useEffect, useState } from "react"
import { ImagePlus, Link2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A single image field that accepts EITHER a URL or an uploaded file.
 * Fully controlled — the parent owns both `url` and `file`.
 */
export function ImageField({
  label = "الصورة",
  url,
  onUrlChange,
  file,
  onFileChange,
  shape = "square",
}: {
  label?: string
  url: string
  onUrlChange: (v: string) => void
  file: File | null
  onFileChange: (f: File | null) => void
  shape?: "square" | "circle"
}) {
  const [preview, setPreview] = useState("")

  useEffect(() => {
    if (file) {
      const obj = URL.createObjectURL(file)
      setPreview(obj)
      return () => URL.revokeObjectURL(obj)
    }
    setPreview(url || "")
  }, [file, url])

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative flex size-16 shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground",
            shape === "circle" ? "rounded-full" : "rounded-lg",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative">
            <Link2 className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              dir="ltr"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://…"
              className="pr-9 text-right"
              disabled={!!file}
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer",
              )}
            >
              <ImagePlus className="size-4" />
              رفع صورة
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFileChange(null)}
              >
                <X className="size-4" />
                إزالة الملف
              </Button>
            )}
          </div>
        </div>
      </div>
      {file && (
        <p className="truncate text-xs text-muted-foreground">
          الملف: {file.name}
        </p>
      )}
    </div>
  )
}
