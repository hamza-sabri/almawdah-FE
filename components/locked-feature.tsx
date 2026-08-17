"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { Lock } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MODULE_LABELS } from "@/lib/modules"

type ModuleRef = string | readonly string[] | undefined

function labelFor(module: ModuleRef): string {
  if (!module) return "هذه الميزة"
  const key = Array.isArray(module) ? module[0] : (module as string)
  return MODULE_LABELS[key] ?? "هذه الميزة"
}

type Ctx = { openLocked: (module?: ModuleRef) => void }
const LockedFeatureContext = createContext<Ctx>({ openLocked: () => {} })

export function useLockedFeature() {
  return useContext(LockedFeatureContext)
}

/** Provides the "feature not enabled" dialog to the whole app shell so nav
 *  items can show a locked feature and prompt the user to contact the owner. */
export function LockedFeatureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [module, setModule] = useState<ModuleRef>(undefined)
  const openLocked = useCallback((m?: ModuleRef) => {
    setModule(m)
    setOpen(true)
  }, [])

  return (
    <LockedFeatureContext.Provider value={{ openLocked }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="mx-auto mb-1 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <DialogTitle>ميزة غير مفعّلة</DialogTitle>
            <DialogDescription className="leading-relaxed">
              «{labelFor(module)}» غير مفعّلة لحسابك. تواصل مع صاحب المتجر
              لتفعيلها لك.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => setOpen(false)}>
              حسناً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LockedFeatureContext.Provider>
  )
}

/** Full-page locked state — used by ModuleGuard for direct navigation. */
export function LockedFeatureNotice({ module }: { module?: ModuleRef }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="size-7" />
        </div>
        <h2 className="font-heading text-xl font-bold">
          «{labelFor(module)}» غير مفعّلة
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          هذه الميزة غير متاحة لحسابك حالياً. تواصل مع صاحب المتجر لتفعيلها لك.
        </p>
      </div>
    </div>
  )
}
