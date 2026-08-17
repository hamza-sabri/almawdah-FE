"use client"

import { customFetch } from "@/api/http"

/** Hand-rolled client for owner-managed staff (/api/v1/staff/) — not in the
 *  orval schema yet, so we don't depend on a schema regen to ship the UI. */

export type StaffRole = "owner" | "employee"

export type StaffUser = {
  id: number
  username: string
  first_name: string
  last_name: string
  display_name: string
  phone: string
  role: StaffRole
  allowed_modules: string[]
  is_active: boolean
  is_owner: boolean
  date_joined: string
  last_login: string | null
}

export type StaffPayload = Partial<{
  username: string
  first_name: string
  last_name: string
  display_name: string
  phone: string
  role: StaffRole
  allowed_modules: string[]
  is_active: boolean
  password: string
}>

type Paginated<T> = { count: number; results: T[] }

/** customFetch returns an orval-style { status, data } envelope — unwrap it. */
const call = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await customFetch<{ status: number; data: T }>(url, options)
  return res.data
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const staffList = () =>
  call<Paginated<StaffUser> | StaffUser[]>("/api/v1/staff/").then((d) =>
    Array.isArray(d) ? d : d.results,
  )

export const staffCreate = (payload: StaffPayload) =>
  call<StaffUser>("/api/v1/staff/", jsonInit("POST", payload))

export const staffUpdate = (id: number, payload: StaffPayload) =>
  call<StaffUser>(`/api/v1/staff/${id}/`, jsonInit("PATCH", payload))

export const staffResetPassword = (id: number, password: string) =>
  call<{ status: string }>(
    `/api/v1/staff/${id}/reset-password/`,
    jsonInit("POST", { password }),
  )
