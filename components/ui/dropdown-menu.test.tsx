import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

/**
 * Regression guard for the mobile-logout crash (Base UI error #31 —
 * "MenuGroupContext is missing"). `DropdownMenuLabel` IS `Menu.GroupLabel` and
 * throws unless wrapped in a `Menu.Group`. The mobile profile menu now uses
 * plain <div> headers instead. These tests lock that in.
 */
describe("mobile profile dropdown — Base UI #31 regression guard", () => {
  it("the FIXED structure (plain-div headers + items) opens without crashing", () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger render={<button aria-label="الحساب">A</button>} />
        <DropdownMenuContent>
          <div>حسابي</div>
          <div className="my-1 h-px bg-border" />
          <div>المظهر</div>
          <DropdownMenuItem>فاتح</DropdownMenuItem>
          <DropdownMenuItem>تسجيل الخروج</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByText("تسجيل الخروج")).toBeInTheDocument()
    expect(screen.getByText("المظهر")).toBeInTheDocument()
  })

  it("a BARE DropdownMenuLabel throws (the old bug) — it must be a div or live inside a group", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() =>
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<button>A</button>} />
          <DropdownMenuContent>
            <DropdownMenuLabel>المظهر</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>,
      ),
    ).toThrow()
    spy.mockRestore()
  })
})
