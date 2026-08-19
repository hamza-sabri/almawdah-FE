import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { TopupButtons, TOPUP_AMOUNTS } from "@/components/pos/topup-buttons"

/**
 * Mobile top-up — the shop's second most-transacted line in the old system:
 * 3,145 sales, ₪83,575, all under one catalogue item called "شحن رصيد" with a
 * nominal ₪1 price. The cashier keyed the real amount every time and the two
 * networks were indistinguishable afterwards.
 */
describe("top-up buttons", () => {
  it("tapping the network sells NOTHING — it only asks for the amount", () => {
    // The first version added ₪10 on this tap. Every ₪50 top-up then left a
    // phantom ₪10 line on the receipt, which is money out of the till.
    const onAdd = vi.fn()
    render(<TopupButtons onAdd={onAdd} />)
    fireEvent.click(screen.getByText("جوال"))
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText("50")).toBeTruthy() // the picker is open
  })

  it("adds exactly one line, with the amount that was pressed", () => {
    const onAdd = vi.fn()
    render(<TopupButtons onAdd={onAdd} />)
    fireEvent.click(screen.getByText("جوال"))
    fireEvent.click(screen.getByText("50"))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith("تعبئة كرت جوال", 50)
  })

  it("names the network, so the sale can be split later", () => {
    const onAdd = vi.fn()
    render(<TopupButtons onAdd={onAdd} />)
    fireEvent.click(screen.getByText("جوال"))
    fireEvent.click(screen.getByText("20"))
    expect(onAdd).toHaveBeenCalledWith("تعبئة كرت جوال", 20)
  })

  it("does not offer وطنية — the shop does not sell it", () => {
    render(<TopupButtons onAdd={vi.fn()} />)
    expect(screen.queryByText("وطنية")).toBeNull()
  })

  it("offers 10, 20, 30, 50 and 100", () => {
    expect([...TOPUP_AMOUNTS]).toEqual([10, 20, 30, 50, 100])
    render(<TopupButtons onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText("جوال"))
    for (const amt of TOPUP_AMOUNTS) {
      expect(screen.getByText(String(amt))).toBeTruthy()
    }
  })

  it("closes the amount chips once one is chosen", () => {
    render(<TopupButtons onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText("جوال"))
    fireEvent.click(screen.getByText("30"))
    expect(screen.queryByText("30")).toBeNull()
  })

  it("closes when the cashier taps somewhere else", () => {
    render(<TopupButtons onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText("جوال"))
    expect(screen.getByText("50")).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText("50")).toBeNull()
  })

  it("closes on Escape", () => {
    render(<TopupButtons onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText("جوال"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByText("50")).toBeNull()
  })

  it("opens only one picker at a time", () => {
    render(<TopupButtons onAdd={vi.fn()} />)
    fireEvent.click(screen.getByText("جوال"))
    expect(screen.getAllByRole("menu")).toHaveLength(1)
  })
})
