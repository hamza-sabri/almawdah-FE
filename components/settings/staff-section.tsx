"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  staffCreate,
  staffList,
  staffResetPassword,
  staffUpdate,
  type StaffPayload,
  type StaffRole,
  type StaffUser,
} from "@/api/staff"
import { MODULE_LABELS } from "@/lib/modules"
import { useMe } from "@/hooks/use-me"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const MODULE_KEYS = Object.keys(MODULE_LABELS)

type FormState = {
  username: string
  display_name: string
  phone: string
  password: string
  role: StaffRole
  allowed_modules: string[]
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  username: "",
  display_name: "",
  phone: "",
  password: "",
  role: "employee",
  allowed_modules: [],
  is_active: true,
}

function formFrom(u: StaffUser): FormState {
  return {
    username: u.username,
    display_name: u.display_name ?? "",
    phone: u.phone ?? "",
    password: "",
    role: u.role,
    allowed_modules: u.allowed_modules ?? [],
    is_active: u.is_active,
  }
}

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback

export function StaffSection() {
  const qc = useQueryClient()
  const { user: me } = useMe()
  const myId = me?.id

  const {
    data: staff = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["staff"], queryFn: staffList, staleTime: 30_000 })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [pwOpen, setPwOpen] = useState(false)
  const [pwUser, setPwUser] = useState<StaffUser | null>(null)
  const [pwValue, setPwValue] = useState("")

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }
  function openEdit(u: StaffUser) {
    setEditing(u)
    setForm(formFrom(u))
    setDialogOpen(true)
  }
  function openReset(u: StaffUser) {
    setPwUser(u)
    setPwValue("")
    setPwOpen(true)
  }
  function toggleModule(key: string) {
    setForm((f) => ({
      ...f,
      allowed_modules: f.allowed_modules.includes(key)
        ? f.allowed_modules.filter((k) => k !== key)
        : [...f.allowed_modules, key],
    }))
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: StaffPayload = {
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        allowed_modules: form.allowed_modules,
        is_active: form.is_active,
      }
      if (form.password) payload.password = form.password
      return editing ? staffUpdate(editing.id, payload) : staffCreate(payload)
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث المستخدم" : "تمت إضافة المستخدم")
      setDialogOpen(false)
      void qc.invalidateQueries({ queryKey: ["staff"] })
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
  })

  const activeMut = useMutation({
    mutationFn: (u: StaffUser) => staffUpdate(u.id, { is_active: !u.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e) => {
      toast.error(errMsg(e, "تعذّر التحديث"))
      void qc.invalidateQueries({ queryKey: ["staff"] }) // snap back to server truth
    },
  })

  const resetMut = useMutation({
    mutationFn: () => staffResetPassword(pwUser!.id, pwValue),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور")
      setPwOpen(false)
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر التغيير")),
  })

  return (
    <section className="mb-5 rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-bold">الموظفون</h2>
          <p className="text-xs text-muted-foreground">
            أضِف حسابات الموظفين وتحكّم بصلاحياتهم
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> إضافة مستخدم
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : isError ? (
        <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          تعذّر تحميل قائمة الموظفين.
        </p>
      ) : staff.length === 0 ? (
        <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          لا يوجد موظفون بعد — اضغط «إضافة مستخدم».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {staff.map((u) => {
            const isMe = u.id === myId
            return (
              <li
                key={u.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3",
                  !u.is_active && "opacity-60",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
                  {u.role === "owner" ? (
                    <ShieldCheck className="size-4 text-primary" />
                  ) : (
                    <UserIcon className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {u.display_name || u.username}
                    </span>
                    {u.role === "owner" && <Badge variant="secondary">مالك</Badge>}
                    {isMe && <Badge variant="outline">أنت</Badge>}
                  </div>
                  <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                    @{u.username}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="إعادة تعيين كلمة المرور"
                  onClick={() => openReset(u)}
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="تعديل"
                  onClick={() => openEdit(u)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Switch
                  checked={u.is_active}
                  disabled={isMe || activeMut.isPending}
                  onCheckedChange={() => activeMut.mutate(u)}
                  aria-label={u.is_active ? "تعطيل الحساب" : "تفعيل الحساب"}
                />
              </li>
            )
          })}
        </ul>
      )}

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={(o) => setDialogOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مستخدم" : "إضافة مستخدم"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "حدّث بيانات المستخدم وصلاحياته."
                : "أنشئ حساباً جديداً لموظف في متجرك."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-0.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-name">الاسم الظاهر</Label>
              <Input
                id="st-name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="مثال: أحمد"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-username">اسم المستخدم</Label>
              <Input
                id="st-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="username"
                dir="ltr"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="st-pass">
                {editing ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور"}
              </Label>
              <Input
                id="st-pass"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••"
                dir="ltr"
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>الدور</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["employee", "owner"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={cn(
                      "rounded-xl border p-2.5 text-sm font-medium transition",
                      form.role === r
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {r === "owner" ? "مالك" : "موظف"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>الصلاحيات</Label>
              <p className="text-xs text-muted-foreground">
                بدون تحديد = وصول لكل وحدات المتجر.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MODULE_KEYS.map((key) => {
                  const on = form.allowed_modules.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleModule(key)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {MODULE_LABELS[key]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <span className="block text-sm font-semibold">الحساب مفعّل</span>
                <span className="block text-xs text-muted-foreground">
                  الحساب المعطّل لا يستطيع تسجيل الدخول.
                </span>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saveMut.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={
                saveMut.isPending ||
                !form.username.trim() ||
                (!editing && form.password.length < 4)
              }
            >
              {saveMut.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={pwOpen} onOpenChange={(o) => setPwOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>
              لـ {pwUser?.display_name || pwUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="st-newpass">كلمة المرور الجديدة</Label>
            <Input
              id="st-newpass"
              type="password"
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              dir="ltr"
              autoComplete="new-password"
              placeholder="4 أحرف على الأقل"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPwOpen(false)}
              disabled={resetMut.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending || pwValue.length < 4}
            >
              {resetMut.isPending && <Loader2 className="size-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
