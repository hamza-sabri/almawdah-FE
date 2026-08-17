"use client"

import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { ImagePlus, Link2, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** One photo in the picker. A `file` = new upload; an `existingId` = a photo
 *  already saved on the product (gallery). Plain `url` with neither = a
 *  pasted link. Exactly one photo is the "main" (starred). */
export type MedPhoto = {
  key: string
  url: string
  file?: File
  existingId?: number
}

/** 1 main + up to 8 gallery photos (backend MAX_GALLERY = 8). */
const MAX = 9

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p_${Math.random().toString(36).slice(2)}_${Date.now()}`

export function MedicationImages({
  photos,
  setPhotos,
  mainKey,
  setMainKey,
}: {
  photos: MedPhoto[]
  setPhotos: Dispatch<SetStateAction<MedPhoto[]>>
  mainKey: string | null
  setMainKey: Dispatch<SetStateAction<string | null>>
}) {
  const [tab, setTab] = useState<"upload" | "urls">("upload")
  const [urlDraft, setUrlDraft] = useState("")
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: File[]) {
    const imgs = list.filter((f) => f.type.startsWith("image/"))
    if (imgs.length === 0) return
    const created: MedPhoto[] = imgs.map((f) => ({
      key: uid(),
      url: URL.createObjectURL(f),
      file: f,
    }))
    setPhotos((prev) => [...prev, ...created].slice(0, MAX))
    if (!mainKey) setMainKey(created[0].key)
  }

  function addUrls(text: string) {
    const urls = text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
    if (urls.length === 0) return
    const created: MedPhoto[] = []
    for (const u of urls) {
      if (!photos.some((p) => p.url === u) && !created.some((p) => p.url === u)) {
        created.push({ key: uid(), url: u })
      }
    }
    if (created.length === 0) return
    setPhotos((prev) => [...prev, ...created].slice(0, MAX))
    if (!mainKey) setMainKey(created[0].key)
    setUrlDraft("")
  }

  function removePhoto(key: string) {
    const next = photos.filter((p) => p.key !== key)
    setPhotos(() => next)
    if (mainKey === key) setMainKey(next[0]?.key ?? null)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Label>صور المنتج</Label>

      {/* Source tabs — upload/drag OR paste links */}
      <div className="flex gap-1 rounded-full bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition",
            tab === "upload" ? "bg-card shadow-sm" : "text-muted-foreground",
          )}
        >
          <ImagePlus className="size-4" /> رفع / سحب
        </button>
        <button
          type="button"
          onClick={() => setTab("urls")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition",
            tab === "urls" ? "bg-card shadow-sm" : "text-muted-foreground",
          )}
        >
          <Link2 className="size-4" /> روابط
        </button>
      </div>

      {tab === "upload" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            addFiles(Array.from(e.dataTransfer.files))
          }}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition",
            over
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          <ImagePlus className="size-6 text-primary" />
          اسحب صوراً هنا أو اضغط للاختيار — يمكن اختيار عدة صور
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ""
            }}
          />
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            rows={3}
            dir="ltr"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="الصق روابط الصور — كل رابط في سطر، أو مفصولة بمسافة…"
            className="text-start"
          />
          <Button type="button" variant="secondary" onClick={() => addUrls(urlDraft)} disabled={!urlDraft.trim()}>
            <Link2 className="size-4" /> إضافة الروابط
          </Button>
        </div>
      )}

      {/* Thumbnails — one star = the main image */}
      {photos.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            اضغط النجمة ⭐ لتحديد الصورة الرئيسية (صورة واحدة فقط)
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((p) => {
              const isMain = p.key === mainKey
              return (
                <div
                  key={p.key}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border",
                    isMain ? "border-lime ring-2 ring-lime" : "border-border",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="اجعلها الصورة الرئيسية"
                    onClick={() => setMainKey(p.key)}
                    className={cn(
                      "absolute start-1 top-1 grid size-6 place-items-center rounded-full shadow",
                      isMain ? "bg-lime text-lime-foreground" : "bg-black/45 text-white",
                    )}
                  >
                    <Star className={cn("size-3.5", isMain && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    aria-label="حذف الصورة"
                    onClick={() => removePhoto(p.key)}
                    className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/45 text-white transition hover:bg-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                  {isMain && (
                    <span className="absolute inset-x-0 bottom-0 bg-lime/90 py-0.5 text-center text-[10px] font-bold text-lime-foreground">
                      الرئيسية
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
