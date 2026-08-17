"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { updateBranding } from "@/api/branding-settings"
import { useBranding } from "@/hooks/use-branding"
import { BrandMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LS_KEY = "pharma_branding_v1"

export function BrandingSection() {
  const qc = useQueryClient()
  const { name: currentName, logo: currentLogo } = useBranding()

  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Prefill the name once branding loads (currentName may arrive after mount).
  useEffect(() => setName(currentName), [currentName])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = "" // allow re-picking the same file
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const nameChanged = name.trim().length > 0 && name.trim() !== currentName
  const canSave = Boolean(file) || nameChanged

  const saveMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      if (file) fd.append("logo_file", file)
      if (nameChanged) fd.append("name", name.trim())
      return updateBranding(fd)
    },
    onSuccess: () => {
      toast.success("تم تحديث هوية المتجر")
      try {
        window.localStorage.removeItem(LS_KEY) // drop the mirror so it can't mask the change
      } catch {
        /* private mode */
      }
      void qc.invalidateQueries({ queryKey: ["public-branding"] })
      void qc.invalidateQueries({ queryKey: ["/api/v1/auth/me/"] })
      setFile(null)
      setPreview("")
    },
    onError: (e) =>
      toast.error(e instanceof Error && e.message ? e.message : "تعذّر التحديث"),
  })

  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <h2 className="mb-1 font-heading text-base font-bold">هوية المتجر</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        الشعار والاسم الظاهر للزبائن في صفحة الأسعار والفواتير
      </p>

      <div className="flex items-center gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-muted">
          {preview || currentLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview || currentLogo}
              alt=""
              className="size-full object-contain"
            />
          ) : (
            <BrandMark className="size-10 opacity-60" />
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickFile}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" /> اختر شعاراً
          </Button>
          {file && (
            <span className="max-w-[12rem] truncate text-xs text-muted-foreground" dir="ltr">
              {file.name}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="brand-name">اسم المتجر</Label>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={currentName}
        />
      </div>

      <Button
        className="mt-4"
        onClick={() => saveMut.mutate()}
        disabled={!canSave || saveMut.isPending}
      >
        {saveMut.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        حفظ
      </Button>
    </section>
  )
}
