import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { AltBarcodesField } from "@/components/forms/alt-barcodes-field"

/**
 * One product, several barcodes.
 *
 * A shop item routinely carries more than one code — the shelf label, the
 * supplier's box, a re-printed sticker, the unit code on a multipack. Any of
 * them has to open the product at the till, so the cashier never needs to know
 * which sticker is "the real one".
 */
const input = () => screen.getByPlaceholderText("امسح أو أدخل باركود إضافي")

describe("adding extra barcodes", () => {
  it("adds a typed code", () => {
    const onChange = vi.fn()
    render(<AltBarcodesField value={[]} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: "6291234567890" } })
    fireEvent.click(screen.getByLabelText("إضافة الباركود"))
    expect(onChange).toHaveBeenCalledWith(["6291234567890"])
  })

  it("Enter adds the code and does NOT submit the product form", () => {
    // A scanner ends its burst with Enter. If that submitted the form, the
    // product would save halfway through entering its codes.
    const onChange = vi.fn()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <AltBarcodesField value={[]} onChange={onChange} />
      </form>,
    )
    fireEvent.change(input(), { target: { value: "111" } })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith(["111"])
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("trims whitespace", () => {
    const onChange = vi.fn()
    render(<AltBarcodesField value={[]} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: "  222  " } })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith(["222"])
  })

  it("refuses a duplicate with a visible reason", () => {
    const onChange = vi.fn()
    render(<AltBarcodesField value={["222"]} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: "222" } })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText("هذا الباركود مضاف بالفعل")).toBeTruthy()
  })

  it("ignores an empty entry", () => {
    const onChange = vi.fn()
    render(<AltBarcodesField value={[]} onChange={onChange} />)
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("has no limit on how many", () => {
    const many = Array.from({ length: 30 }, (_, i) => String(1000 + i))
    const onChange = vi.fn()
    render(<AltBarcodesField value={many} onChange={onChange} />)
    fireEvent.change(input(), { target: { value: "9999" } })
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith([...many, "9999"])
  })
})

describe("removing", () => {
  it("drops just the one clicked", () => {
    const onChange = vi.fn()
    render(<AltBarcodesField value={["111", "222", "333"]} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText("حذف الباركود 222"))
    expect(onChange).toHaveBeenCalledWith(["111", "333"])
  })
})
