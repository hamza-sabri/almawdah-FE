import {
  Store,
  Boxes,
  Users,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  ChartPie,
  FileUp,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Hidden from the mobile bottom bar (still in the desktop rail). */
  desktopOnly?: boolean
  /**
   * Feature module(s) that unlock this item (array = any-of). Matches
   * `user.modules` from /auth/me/ — see lib/modules.ts. Omit = always shown.
   */
  module?: string | string[]
  /** Locked for employee accounts (owner/superuser only). */
  ownerOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/pos", label: "البيع", icon: Store, module: "pos" },
  { href: "/inventory", label: "المخزون", icon: Boxes, module: "inventory" },
  {
    href: "/customers",
    label: "الزبائن",
    icon: Users,
    // Customer profiles serve POS credit sales and the debt ledger too.
    module: ["customers", "debts", "pos"],
    // Moved OFF the mobile bottom bar → the profile dropdown + a button on the
    // debts page. Still in the desktop rail.
    desktopOnly: true,
  },
  // Debts moved OFF the mobile bottom bar → dropdown + a button on the sales
  // page. Still in the desktop rail.
  { href: "/debts", label: "الديون", icon: ReceiptText, module: "debts", desktopOnly: true },
  {
    // POS-like restock/purchase builder + quota. Owner-only; shows on the
    // desktop rail and the mobile bottom bar (took the customers slot).
    href: "/purchases",
    label: "المشتريات",
    icon: ShoppingCart,
    module: "purchases",
    ownerOnly: true,
  },
  // On the mobile bottom bar (took the debts slot) + the desktop rail.
  { href: "/sales", label: "المبيعات", icon: ShoppingBag, module: "pos" },
  {
    href: "/reports",
    label: "التقارير",
    icon: ChartPie,
    desktopOnly: true,
    module: "reports",
    ownerOnly: true,
  },
  {
    href: "/import",
    label: "استيراد البيانات",
    icon: FileUp,
    desktopOnly: true,
    module: "imports",
    // Imports rewrite the catalogue — owner-only (enforced server-side too).
    ownerOnly: true,
  },
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/")
}
