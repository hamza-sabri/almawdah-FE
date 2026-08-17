"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusCircle } from "lucide-react"

import { customersList } from "@/api/generated/customers/customers"
import type { Customer } from "@/api/generated/model"
import { useInfiniteList } from "@/hooks/use-infinite-list"
import { useDebounced } from "@/hooks/use-debounced"
import { useStaggerCards } from "@/hooks/use-stagger-cards"
import { ENDPOINTS, remove } from "@/lib/mutate"
import { formatMoney, formatNumber, toNumber } from "@/lib/format"

import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { SortMenu, type SortOption } from "@/components/sort-menu"
import { LoadMore } from "@/components/load-more"
import { Fab } from "@/components/fab"
import { RowActions } from "@/components/row-actions"
import { GenderBadge } from "@/components/gender-badge"
import { EmptyState, ErrorState } from "@/components/states"
import { NoCustomersArt } from "@/components/illustrations"
import { CustomerForm } from "@/components/forms/customer-form"
import { ConfirmDelete } from "@/components/confirm-delete"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "الاسم (أ–ي)" },
  { value: "-created_at", label: "الأحدث" },
]

function CustomerCard({
  customer,
  onEdit,
  onDelete,
}: {
  customer: Customer
  onEdit: () => void
  onDelete: () => void
}) {
  const outstanding = toNumber(customer.outstanding)
  return (
    <Card className="customer-card card-interactive gap-0 p-0">
      <div className="flex items-start gap-3 p-4">
        <Link href={`/customers/${customer.id}`} className="shrink-0">
          <div className="rounded-full bg-brand-gradient p-[2px]">
            <Avatar className="size-12 ring-2 ring-card">
              <AvatarImage src={customer.avatar || undefined} alt="" />
              <AvatarFallback className="bg-card text-primary">
                {customer.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>
        </Link>
        <Link href={`/customers/${customer.id}`} className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{customer.name}</p>
          {customer.phone && (
            <p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">
              {customer.phone}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <GenderBadge gender={customer.gender} />
            {customer.status && (
              <Badge variant="secondary" className="font-normal">
                {customer.status}
              </Badge>
            )}
          </div>
        </Link>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">الرصيد المستحق</span>
        <span
          className={
            outstanding > 0
              ? "pill pill-warning font-heading text-sm"
              : "pill pill-success"
          }
        >
          {formatMoney(customer.outstanding)}
        </span>
      </div>
    </Card>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="gap-0 p-0">
          <div className="flex items-start gap-3 p-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 rounded-none" />
        </Card>
      ))}
    </div>
  )
}

export default function CustomersPage() {
  const qc = useQueryClient()
  const [searchRaw, setSearchRaw] = useState("")
  const search = useDebounced(searchRaw, 300)
  const [gender, setGender] = useState("all")
  const [ordering, setOrdering] = useState("name")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [toDelete, setToDelete] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const scope = useRef<HTMLDivElement>(null)

  const params = useMemo(
    () => ({
      search: search || undefined,
      gender: gender === "all" ? undefined : gender,
      ordering,
      page_size: 24,
    }),
    [search, gender, ordering],
  )

  const {
    items,
    count,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteList<Customer>(["customers"], customersList, params)

  useStaggerCards(scope, ".customer-card", !isLoading && items.length > 0, [
    search,
    gender,
    ordering,
  ])

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await remove(ENDPOINTS.customers, toDelete.id)
      toast.success("تم حذف الزبون")
      qc.invalidateQueries({ queryKey: ["customers"] })
    qc.invalidateQueries({ queryKey: ["customers-quick"] })
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] })
      setToDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحذف")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="الزبائن"
        description={count ? `${formatNumber(count)} زبون` : "إدارة ملفات الزبائن"}
        action={
          <Button onClick={openAdd} data-tour="page-add" className="hidden md:inline-flex">
            <PlusCircle className="size-4" />
            إضافة زبون
          </Button>
        }
      />

      <StickyToolbar>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="ابحث بالاسم أو الهاتف…"
            className="flex-1"
          />
          <SortMenu
            value={ordering}
            options={SORT_OPTIONS}
            onChange={setOrdering}
          />
        </div>
      </StickyToolbar>

      <Tabs value={gender} onValueChange={setGender} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="male">ذكور</TabsTrigger>
          <TabsTrigger value="female">إناث</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <GridSkeleton />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          art={<NoCustomersArt className="h-36 w-auto" />}
          title="لا يوجد زبائن"
          description="ابدأ بإضافة أول زبون"
          action={
            <Button onClick={openAdd} size="sm">
              <PlusCircle className="size-4" />
              إضافة زبون
            </Button>
          }
        />
      )}

      {items.length > 0 && (
        <>
          <div
            ref={scope}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onEdit={() => {
                  setEditing(c)
                  setFormOpen(true)
                }}
                onDelete={() => setToDelete(c)}
              />
            ))}
          </div>
          <LoadMore
            hasNext={Boolean(hasNextPage)}
            isFetchingNext={isFetchingNextPage}
            onLoad={() => fetchNextPage()}
          />
        </>
      )}

      <Fab onClick={openAdd} label="إضافة زبون" />
      <CustomerForm open={formOpen} onOpenChange={setFormOpen} customer={editing} />
      <ConfirmDelete
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف الزبون"
        description={
          toDelete ? `سيتم حذف «${toDelete.name}» وكل ديونه.` : undefined
        }
      />
    </div>
  )
}
