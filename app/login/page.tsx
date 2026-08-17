"use client"

import { Suspense, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { login } from "@/lib/auth"
import { isCentral, pharmacyPosUrl, getPharmacySlug } from "@/lib/site"
import {
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  clearTokens,
  setTokens,
} from "@/lib/tokens"
import {
  saveOfflineCredential,
  unlockOffline,
  hasOfflineCredential,
} from "@/lib/offline/credential"
import { BrandMark } from "@/components/brand"
import { useBranding } from "@/hooks/use-branding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


const schema = z.object({
  username: z.string().min(1, "أدخل اسم المستخدم"),
  password: z.string().min(1, "أدخل كلمة المرور"),
})

type FormValues = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const params = useSearchParams()
  const next = params.get("next") || "/pos"
  const [showPassword, setShowPassword] = useState(false)
  const { name: brandName } = useBranding()

  useEffect(() => {
    if (!isCentral() && isAuthenticated()) router.replace(next)
  }, [router, next])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  })

  async function onSubmit(values: FormValues) {
    try {
      const user = await login(values.username, values.password)
      qc.clear()
      toast.success(`مرحباً ${user.display_name || user.username}`)
      if (isCentral()) {
        const slug = user.store_slug
        const access = getAccessToken()
        const refresh = getRefreshToken()
        clearTokens()
        if (!slug || !access || !refresh) {
          toast.error("لا يوجد متجر مرتبط بهذا الحساب")
          return
        }
        window.location.assign(pharmacyPosUrl(slug, { access, refresh }))
        return
      }
      const access = getAccessToken()
      const refresh = getRefreshToken()
      const currentSlug = getPharmacySlug()
      if (
        user.store_slug &&
        currentSlug &&
        user.store_slug !== currentSlug
      ) {
        clearTokens()
        if (access && refresh) {
          toast.success("جارٍ تحويلك إلى متجرك…")
          window.location.assign(
            pharmacyPosUrl(user.store_slug, { access, refresh }),
          )
          return
        }
        toast.error("لا يوجد متجر مرتبط بهذا الحساب")
        return
      }
      if (access && refresh) {
        await saveOfflineCredential(values.username, values.password, {
          access,
          refresh,
        })
      }
      router.replace(next)
    } catch {
      if (!isCentral() && hasOfflineCredential(values.username)) {
        const tokens = await unlockOffline(values.username, values.password)
        if (tokens) {
          setTokens(tokens.access, tokens.refresh)
          toast.success("تم الدخول بدون إنترنت")
          router.replace(next)
          return
        }
        const online =
          typeof navigator === "undefined" || navigator.onLine !== false
        toast.error(
          online
            ? "تعذر تسجيل الدخول. تحقق من البيانات."
            : "كلمة المرور غير صحيحة (وضع بدون إنترنت)",
        )
        return
      }
      toast.error("تعذر تسجيل الدخول. تحقق من البيانات.")
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* ── Showcase ink panel ─────────────────────────────────────── */}
      <section className="ink-panel animate-in fade-in relative m-3 hidden flex-col justify-between overflow-hidden rounded-[28px] p-10 duration-700 lg:flex">
        <div className="panel-anim relative flex items-center gap-3">
          <BrandMark className="size-11" />
          <span className="font-heading text-lg font-bold text-white">
            {brandName}
          </span>
        </div>
        <div className="relative max-w-md">
          <p className="panel-anim mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-lime ring-1 ring-white/15">
            <Sparkles className="size-3.5" />
            نظام إدارة المتجر
          </p>
          <h2 className="panel-anim font-heading text-3xl font-bold leading-snug text-white xl:text-4xl">
            كل أصنافك وزبائنك وديونك —
            <span className="text-lime"> في مكان واحد</span>
          </h2>
          <p className="panel-anim mt-3 text-sm leading-relaxed text-white/60">
            تتبّع المخزون، سجّل الديون بلمسة، وامسح الباركود مباشرة من هاتفك.
          </p>
        </div>
        <p className="panel-anim relative flex items-center gap-2 text-xs text-white/45">
          <ShieldCheck className="size-4" />
          نظام داخلي مؤمّن لطاقم المتجر فقط
        </p>
      </section>

      {/* ── Form side ──────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center overflow-hidden p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="animate-in fade-in slide-in-from-bottom-4 w-full max-w-sm duration-500">
          <div className="login-anim mb-8 flex flex-col items-center text-center lg:items-start lg:text-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/store-shop.png"
              alt=""
              aria-hidden="true"
              className="float-slow mb-2 h-40 w-40 drop-shadow-xl lg:h-44 lg:w-44 lg:self-center"
            />
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
              أهلاً بعودتك 👋
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              سجّل الدخول للوصول إلى لوحة التحكم
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="login-anim flex flex-col gap-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input
                id="username"
                autoComplete="username"
                placeholder="اسم المستخدم"
                className="h-11 rounded-xl text-right"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="login-anim flex flex-col gap-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="كلمة المرور"
                  className="h-11 rounded-xl text-right pe-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="login-anim mt-2 h-11 w-full rounded-xl bg-brand-gradient text-base shadow-lg shadow-primary/30"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              تسجيل الدخول
            </Button>
          </form>

          <p className="login-anim mt-6 text-center text-xs text-muted-foreground lg:text-start">
            نظام داخلي لطاقم المتجر فقط
          </p>
        </div>
      </section>
    </main>
  )
}

// useSearchParams() must sit inside a Suspense boundary or Next's static
// prerender of /login bails out and the production build fails.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  )
}
