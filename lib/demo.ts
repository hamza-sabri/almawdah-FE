"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { login } from "@/lib/auth"

// Public showcase tenant seeded by `python manage.py seed_demo` (demo/demo).
// Overridable per-deployment without a rebuild-time secret since it's public.
const DEMO_USER = process.env.NEXT_PUBLIC_DEMO_USERNAME || "demo"
const DEMO_PASS = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo"

/**
 * One-click "try the whole thing" — logs into the public demo tenant and drops
 * the visitor into the real app at /pos. No signup. If the demo tenant hasn't
 * been seeded yet the login fails gracefully with a toast.
 */
export function useDemoLogin() {
  const router = useRouter()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function start() {
    if (loading) return
    setLoading(true)
    try {
      await login(DEMO_USER, DEMO_PASS)
      qc.clear()
      router.replace("/pos")
    } catch {
      toast.error("النسخة التجريبية غير متاحة حالياً — حاول لاحقاً")
      setLoading(false)
    }
  }

  return { start, loading }
}
