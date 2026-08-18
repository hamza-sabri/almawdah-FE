"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronLeft, Layers, Loader2, Lock, Package, Save, ScanBarcode } from "lucide-react"
import { toast } from "sonner"

import { FormModal } from "@/components/form-modal"
import { ScanDialog } from "@/components/scan/scan-dialog"
import { TaxonomyCombobox } from "@/components/taxonomy-combobox"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MedicationImages,
  type MedPhoto,
  uid,
} from "@/components/product-images"
import { VideoPlayer } from "@/components/video-player"
import { AttributesEditor } from "@/components/attributes-editor"
import { ENDPOINTS, upsert } from "@/lib/mutate"
import { cn } from "@/lib/utils"
import { useLockedFeature } from "@/components/locked-feature"
import type { Product } from "@/api/generated/model"

type FormValues = {
  name: string
  category: string
  barcode: string
  price: string
  cost: string
  brand: string
  manufacturer: string
  stock: string
  notes: string
  expiry_date: string
  expiry_alert_days: string
}

const empty: FormValues = {
  name: "",
  category: "",
  barcode: "",
  price: "",
  cost: "",
  brand: "",
  manufacturer: "",
  stock: "",
  notes: "",
  expiry_date: "",
  expiry_alert_days: "",
}

function Field({
  label,
  error,
  highlight,
  children,
}: {
  label: string
  error?: string
  /** Draw attention to this field (e.g. the one the report filter flagged). */
  highlight?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // When flagged, auto-focus this field and give it a quick bounce so it's
  // obvious what to edit.
  useEffect(() => {
    if (!highlight || !ref.current) return
    const el = ref.current
    const t = setTimeout(() => {
      el
        .querySelector<HTMLElement>(
          "input, textarea, [role='combobox'], button",
        )
        ?.focus?.()
      gsap.fromTo(
        el,
        { scale: 0.96 },
        { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" },
      )
    }, 180)
    return () => clearTimeout(t)
  }, [highlight])
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-1.5",
        highlight && "rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/40",
      )}
    >
      <Label className={cn(highlight && "text-primary")}>
        {label}
        {highlight && (
          <span className="ms-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            عدّل هنا
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/**
 * The extras panel (cost, brand, manufacturer, expiry alerts, variants) is not
 * part of what this store bought. Kept in the tree rather than deleted so
 * turning it back on is this one line, not a re-implementation.
 */
const EXTRAS_ENABLED = false

export function MedicationForm({
  open,
  onOpenChange,
  product,
  onManageVariants,
  initialBarcode,
  highlight,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product?: Product | null
  onManageVariants?: () => void
  /** Scan-to-create: prefill the barcode when adding a product that a scan
   *  just failed to find (the cashier only types name + price). */
  initialBarcode?: string
  /** Field to spotlight (from the report filter): name | price | cost | stock |
   *  barcode | category | expiry. */
  highlight?: string
}) {
  const qc = useQueryClient()
  const editing = Boolean(product)
  const [videoUrl, setVideoUrl] = useState("")
  // Unified image picker: main (starred) + gallery, from uploads and/or URLs.
  const [photos, setPhotos] = useState<MedPhoto[]>([])
  const [mainKey, setMainKey] = useState<string | null>(null)
  const initialGalleryIds = useRef<number[]>([])
  const [scanOpen, setScanOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const { openPlanLocked } = useLockedFeature()
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  const [attrSeed, setAttrSeed] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: empty })
  const categoryValue = watch("category")
  const manufacturerValue = watch("manufacturer")

  useEffect(() => {
    if (!open) return
    if (product) {
      reset({
        name: product.name ?? "",
        category: product.category ?? "",
        barcode: product.barcode ?? "",
        price: product.price ?? "",
        cost: product.cost ?? "",
        brand: product.brand ?? "",
        manufacturer: product.manufacturer ?? "",
        stock: product.stock != null ? String(product.stock) : "",
        notes: product.notes ?? "",
        expiry_date: product.expiry_date ?? "",
        expiry_alert_days:
          product.expiry_alert_days != null
            ? String(product.expiry_alert_days)
            : "",
      })
      setVideoUrl(
        (product as unknown as { video_url?: string }).video_url ?? "",
      )
      const gal =
        (product as unknown as { images?: Array<{ id: number; url: string }> })
          .images ?? []
      initialGalleryIds.current = gal.map((g) => g.id)
      const seeded: MedPhoto[] = []
      let mk: string | null = null
      if (product.image) {
        const k = uid()
        seeded.push({ key: k, url: product.image })
        mk = k
      }
      for (const g of gal) seeded.push({ key: uid(), url: g.url, existingId: g.id })
      setPhotos(seeded)
      setMainKey(mk ?? seeded[0]?.key ?? null)
      const attrs =
        (product as unknown as { attributes?: Record<string, string> })
          .attributes ?? {}
      setAttributes(attrs)
      // Surface the extras when editing a med that already uses them.
      setShowMore(
        Boolean(
          product.cost !== "0.00" ||
            product.brand ||
            product.manufacturer ||
            product.image ||
            (product as unknown as { video_url?: string }).video_url ||
            product.notes ||
            Object.keys(attrs).length,
        ),
      )
    } else {
      reset(initialBarcode ? { ...empty, barcode: initialBarcode } : empty)
      setVideoUrl("")
      initialGalleryIds.current = []
      setPhotos([])
      setMainKey(null)
      setAttributes({})
      setShowMore(false)
    }
    setAttrSeed((s) => s + 1)
  }, [open, product, reset, initialBarcode])

  async function onSubmit(v: FormValues) {
    // Resolve the picker into the API shape: the starred photo is the main
    // image (upload or URL); the rest are the gallery — new files, new URLs,
    // and whichever existing photos were kept (the others get removed).
    const main = photos.find((p) => p.key === mainKey) ?? photos[0] ?? null
    const rest = photos.filter((p) => p !== main)
    const mainFile = main?.file
    const galleryFiles = rest.filter((p) => p.file).map((p) => p.file as File)
    const galleryUrls = rest
      .filter((p) => !p.file && !p.existingId)
      .map((p) => p.url.trim())
    const keptIds = new Set(
      rest.filter((p) => p.existingId).map((p) => p.existingId as number),
    )
    const removeIds = initialGalleryIds.current.filter((id) => !keptIds.has(id))
    if (main?.existingId) removeIds.push(main.existingId)

    try {
      await upsert(
        ENDPOINTS.products,
        product?.id,
        {
          name: v.name.trim(),
          category: v.category.trim(),
          barcode: v.barcode.trim(),
          price: v.price.trim() || "0",
          cost: v.cost.trim() || "0",
          brand: v.brand.trim(),
          manufacturer: v.manufacturer.trim(),
          stock: v.stock === "" ? 0 : Number(v.stock),
          notes: v.notes,
          expiry_date: v.expiry_date || null,
          expiry_alert_days:
            v.expiry_alert_days === "" ? null : Number(v.expiry_alert_days),
          attributes,
          image: mainFile ? undefined : main ? main.url.trim() : "",
          video_url: videoUrl.trim(),
          remove_images: removeIds.length ? removeIds.join(",") : undefined,
          image_urls: galleryUrls.length ? galleryUrls : undefined,
        },
        { image_file: mainFile, image_files: galleryFiles },
      )
      toast.success(editing ? "تم تحديث المنتج" : "تمت إضافة المنتج")
      qc.invalidateQueries({ queryKey: ["products"] })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ")
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "تعديل منتج" : "إضافة منتج"}
      icon={<Package className="size-4.5" />}
      footer={
        <>
          <Button
            type="button"
            className="bg-brand-gradient flex-1 shadow-md shadow-primary/25"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            حفظ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </>
      }
    >
      {/* ── Essentials ─────────────────────────────────────────────── */}
      <Field label="الاسم" error={errors.name?.message} highlight={highlight === "name"}>
        <Input
          placeholder="اسم المنتج"
          {...register("name", { required: "أدخل اسم المنتج" })}
        />
        {(() => {
          const shared = (product as unknown as { product_name?: string })
            ?.product_name
          return shared && shared !== watch("name") ? (
            <p className="text-xs text-muted-foreground">
              الاسم الموحّد في الكتالوج: {shared}
            </p>
          ) : null
        })()}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="السعر (₪)" error={errors.price?.message} highlight={highlight === "price"}>
          <Input
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            {...register("price", { required: "أدخل السعر" })}
          />
        </Field>
        <Field label="الكمية بالمخزون" highlight={highlight === "stock"}>
          <Input
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            placeholder="0"
            {...register("stock")}
          />
        </Field>
      </div>

      <Field label="الباركود" highlight={highlight === "barcode"}>
        <div className="relative">
          <Input
            dir="ltr"
            placeholder="امسح أو أدخل الباركود"
            className="pl-12 text-right"
            {...register("barcode")}
          />
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            aria-label="مسح الباركود بالكاميرا"
            className="absolute inset-y-0 end-1.5 my-auto grid size-8 place-items-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary/15"
          >
            <ScanBarcode className="size-4.5" />
          </button>
        </div>
      </Field>

      {/* Expiry — the date + how many days before it to flag the product. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تاريخ انتهاء الصلاحية" highlight={highlight === "expiry"}>
          <DatePicker
            value={watch("expiry_date")}
            onChange={(v) => setValue("expiry_date", v, { shouldDirty: true })}
          />
        </Field>
        <Field label="تنبيه قبل (يوم)">
          <Input
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="افتراضي ٣٠"
            {...register("expiry_alert_days")}
          />
        </Field>
      </div>

      {/* ── Extras — locked on this store's plan ───────────────────────
          The fields underneath (cost, brand, manufacturer, expiry alerts,
          variants) are not part of what this store bought. Showing the row
          greyed with a padlock is deliberate: hiding it entirely makes the
          product look thinner than it is, and the owner has no idea the
          capability exists. Tapping it explains, once, without a sales pitch. */}
      <button
        type="button"
        onClick={() => openPlanLocked("التفاصيل الإضافية")}
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-center justify-between rounded-xl bg-muted/40 px-3.5 py-2.5 text-sm font-medium text-muted-foreground/60 transition hover:bg-muted/60"
      >
        <span className="flex items-center gap-2">
          <Lock className="size-3.5" />
          تفاصيل إضافية (اختياري)
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground/70">
          غير مشمولة
        </span>
      </button>

      {EXTRAS_ENABLED && showMore && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="التكلفة (₪)" highlight={highlight === "cost"}>
              <Input
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                {...register("cost")}
              />
            </Field>
            <Field label="التصنيف" highlight={highlight === "category"}>
              <TaxonomyCombobox
                kind="categories"
                value={categoryValue}
                onChange={(name) =>
                  setValue("category", name, { shouldDirty: true })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="العلامة التجارية">
              <Input {...register("brand")} />
            </Field>
            <Field label="الشركة المنتجة">
              <TaxonomyCombobox
                kind="manufacturers"
                value={manufacturerValue}
                onChange={(name) =>
                  setValue("manufacturer", name, { shouldDirty: true })
                }
              />
            </Field>
          </div>
          <MedicationImages
            photos={photos}
            setPhotos={setPhotos}
            mainKey={mainKey}
            setMainKey={setMainKey}
          />
          {/* Optional product video — a direct file link or YouTube/Vimeo. */}
          <Field label="رابط فيديو المنتج (اختياري)">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…  (رابط MP4 أو يوتيوب)"
              dir="ltr"
              inputMode="url"
            />
            {videoUrl.trim() && <VideoPlayer url={videoUrl} className="mt-2" />}
          </Field>
          <Field label="ملاحظات">
            <Textarea rows={2} {...register("notes")} />
          </Field>
          {editing ? (
            <button
              type="button"
              onClick={onManageVariants}
              className="flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-start transition hover:bg-primary/10"
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Layers className="size-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-bold">الأنواع والأسعار</span>
                  <span className="block text-xs text-muted-foreground">
                    سعّر كل تركيبة (لون × حجم × وزن) على حدة
                  </span>
                </span>
              </span>
              <ChevronLeft className="size-4 text-muted-foreground" />
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              لإضافة أنواع بأسعار مختلفة (لون، حجم، وزن…)، احفظ المنتج أولاً ثم
              افتح «الأنواع والأسعار».
            </div>
          )}
          <AttributesEditor
            key={attrSeed}
            value={attributes}
            onChange={setAttributes}
            title="خصائص وصفية للمنتج (بدون سعر)"
          />
        </div>
      )}

      <ScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetect={(code) =>
          setValue("barcode", code, { shouldDirty: true })
        }
        description="وجّه الكاميرا نحو باركود العبوة لتعبئته تلقائياً"
      />
    </FormModal>
  )
}
