import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { ManualLineRow } from "@/components/pos/manual-line-row"

/**
 * "Add anything" — the escape hatch at the bottom of the cart.
 *
 * A supermarket sells things the catalogue does not have. Without this the
 * cashier either refuses the sale or invents a product row, which pollutes the
 * catalogue forever. The line it writes is the same free-text shape the top-up
 * buttons use, so it rings up, prints and reports like anything else — and it
 * works offline, because nothing is looked up.
 */
function setup(onAdd = vi.fn()) {
  render(<ManualLineRow onAdd={onAdd} />)
  return onAdd
}

function fill({ name, price, qty }: { name?: string; price?: string; qty?: string }) {
  if (name !== undefined)
    fireEvent.change(screen.getByLabelText("اسم الصنف"), { target: { value: name } })
  if (price !== undefined)
    fireEvent.change(screen.getByLabelText("السعر"), { target: { value: price } })
  if (qty !== undefined)
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: qty } })
}

describe("the manual cart line", () => {
  it("sits outside the cart's scroll box, so it never scrolls away", () => {
    // It was a table row, then a sticky <tfoot>; both slid out of reach on a
    // long cart because at some widths the page scrolls, not the card.
    const { container } = render(<ManualLineRow onAdd={vi.fn()} />)
    expect(container.querySelector("tr, tfoot, td")).toBeNull()
  })

  it("stays out of the way until it is needed", () => {
    setup()
    expect(screen.queryByLabelText("اسم الصنف")).toBeNull()
    expect(screen.getByText("إضافة صنف يدوي")).toBeTruthy()
  })

  it("adds a line with the name, price and quantity typed", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "توصيل", price: "12.5", qty: "2" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).toHaveBeenCalledWith("توصيل", 12.5, 2)
  })

  it("defaults the quantity to one, so a single item is two fields", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "خدمة", price: "5" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).toHaveBeenCalledWith("خدمة", 5, 1)
  })

  it("Enter commits, so it never needs the mouse", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "عربون", price: "40" })
    fireEvent.keyDown(screen.getByLabelText("السعر"), { key: "Enter" })
    expect(onAdd).toHaveBeenCalledWith("عربون", 40, 1)
  })

  it("refuses a line with no name — it would print blank on the receipt", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "   ", price: "10" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("refuses a zero or empty price — almost always a mis-tap", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "شيء", price: "0" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    fill({ price: "" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("accepts a fraction — things are sold by weight here", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "جبنة", price: "30", qty: "0.25" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).toHaveBeenCalledWith("جبنة", 30, 0.25)
  })

  it("takes Arabic-Indic digits, which is what the keyboard types", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "بضاعة", price: "٢٥", qty: "٣" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).toHaveBeenCalledWith("بضاعة", 25, 3)
  })

  it("refuses letters in the price rather than reading them as zero", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "شيء", price: "abc" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("shows the running line total before it is committed", () => {
    setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "بضاعة", price: "7.5", qty: "4" })
    expect(screen.getByText("30.00")).toBeTruthy()
  })

  it("clears itself but stays open — these come in threes", () => {
    setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "أ", price: "3" })
    fireEvent.click(screen.getByLabelText("إضافة إلى السلة"))
    expect((screen.getByLabelText("اسم الصنف") as HTMLInputElement).value).toBe("")
    expect((screen.getByLabelText("الكمية") as HTMLInputElement).value).toBe("1")
  })

  it("Escape closes it without adding anything", () => {
    const onAdd = setup()
    fireEvent.click(screen.getByText("إضافة صنف يدوي"))
    fill({ name: "أ", price: "3" })
    fireEvent.keyDown(screen.getByLabelText("اسم الصنف"), { key: "Escape" })
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByText("إضافة صنف يدوي")).toBeTruthy()
  })
})
