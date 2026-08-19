import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { BoxDialog, findBox } from "@/components/inventory/box-dialog"

/**
 * "This also comes in a box" — one click.
 *
 * The variants manager can express a box, but it is built for colours and
 * sizes: attributes, value lists, generated combinations. A shopkeeper who
 * only wants to say "a carton holds 24 and costs ₪20" got a maze. This asks
 * the two questions that matter and writes the same ProductVariant the POS
 * already understands.
 */
const listVariants = vi.fn()
const createVariant = vi.fn()
const updateVariant = vi.fn()
const deleteVariant = vi.fn()

vi.mock("@/api/variants", () => ({
  listVariants: (...a: unknown[]) => listVariants(...a),
  createVariant: (...a: unknown[]) => createVariant(...a),
  updateVariant: (...a: unknown[]) => updateVariant(...a),
  deleteVariant: (...a: unknown[]) => deleteVariant(...a),
}))

function show(props: Partial<React.ComponentProps<typeof BoxDialog>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BoxDialog
        open
        onOpenChange={vi.fn()}
        productId={7}
        productName="لبن الهلال"
        piecePrice="3.50"
        {...props}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listVariants.mockResolvedValue({ data: { results: [] } })
  createVariant.mockResolvedValue({ data: {} })
  updateVariant.mockResolvedValue({ data: {} })
  deleteVariant.mockResolvedValue({ data: {} })
})

describe("which variant is the box", () => {
  it("is the one with a real pack size, not a colour or flavour", () => {
    const box = findBox([
      { pack_size: null, label: "أحمر" },
      { pack_size: "24.000", label: "عبوة ×24" },
    ] as never[])
    expect(box?.label).toBe("عبوة ×24")
  })

  it("is nothing when the product only has plain variants", () => {
    expect(findBox([{ pack_size: null }, { pack_size: "0" }] as never[])).toBeUndefined()
  })
})

describe("adding a box", () => {
  it("suggests the box price as piece price × pieces", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), {
      target: { value: "24" },
    })
    await waitFor(() =>
      expect((screen.getByLabelText(/سعر العبوة/) as HTMLInputElement).value).toBe("84.00"),
    )
  })

  it("stops suggesting once the owner types a price — boxes are usually cheaper", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), { target: { value: "24" } })
    const price = screen.getByLabelText(/سعر العبوة/) as HTMLInputElement
    fireEvent.change(price, { target: { value: "70" } })
    fireEvent.change(screen.getByLabelText(/عدد القطع/), { target: { value: "25" } })
    await waitFor(() => expect(price.value).toBe("70"))
  })

  it("writes a variant the POS already understands", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), { target: { value: "24" } })
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }))
    await waitFor(() => expect(createVariant).toHaveBeenCalled())
    expect(createVariant.mock.calls[0][0]).toMatchObject({
      product: 7,
      label: "عبوة ×24",
      pack_size: "24",
      price: "84.00",
    })
  })

  it("refuses a box of one piece — that is not a box", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), { target: { value: "1" } })
    expect(screen.getByRole("button", { name: "حفظ" })).toBeDisabled()
  })

  it("refuses a zero price", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), { target: { value: "24" } })
    fireEvent.change(screen.getByLabelText(/سعر العبوة/), { target: { value: "0" } })
    expect(screen.getByRole("button", { name: "حفظ" })).toBeDisabled()
  })

  it("takes Arabic-Indic digits, which is what the keyboard types", async () => {
    show()
    fireEvent.change(await screen.findByLabelText(/عدد القطع/), { target: { value: "٢٤" } })
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }))
    await waitFor(() => expect(createVariant).toHaveBeenCalled())
    expect(createVariant.mock.calls[0][0].pack_size).toBe("24")
  })

  it("says the POS still sells a piece by default", async () => {
    show()
    expect(await screen.findByText(/كقطعة دائماً/)).toBeTruthy()
  })
})

describe("an existing box", () => {
  const EXISTING = {
    data: {
      results: [
        { id: 9, label: "عبوة ×12", pack_size: "12.000", price: "30.00", barcode: "B12" },
      ],
    },
  }

  it("keeps the price the owner set, instead of re-suggesting over it", async () => {
    // A box is usually cheaper than its pieces — that is why boxes exist.
    // Auto-filling on open silently reset that.
    listVariants.mockResolvedValue({
      data: {
        results: [
          { id: 9, label: "عبوة ×12", pack_size: "12.000", price: "30.00", barcode: "" },
        ],
      },
    })
    show()
    await waitFor(() =>
      expect((screen.getByLabelText(/سعر العبوة/) as HTMLInputElement).value).toBe("30.00"),
    )
    // 12 × 3.50 would have been 42.00
    expect((screen.getByLabelText(/سعر العبوة/) as HTMLInputElement).value).not.toBe("42.00")
  })

  it("opens prefilled with what is already there", async () => {
    listVariants.mockResolvedValue(EXISTING)
    show()
    await waitFor(() =>
      expect((screen.getByLabelText(/عدد القطع/) as HTMLInputElement).value).toBe("12"),
    )
    expect((screen.getByLabelText(/سعر العبوة/) as HTMLInputElement).value).toBe("30.00")
  })

  it("updates instead of creating a second box", async () => {
    listVariants.mockResolvedValue(EXISTING)
    show()
    await waitFor(() => expect(screen.getByLabelText(/عدد القطع/)).toBeTruthy())
    fireEvent.change(screen.getByLabelText(/عدد القطع/), { target: { value: "24" } })
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }))
    await waitFor(() => expect(updateVariant).toHaveBeenCalled())
    expect(createVariant).not.toHaveBeenCalled()
    expect(updateVariant.mock.calls[0][0]).toBe(9)
  })

  it("can be removed", async () => {
    listVariants.mockResolvedValue(EXISTING)
    show()
    fireEvent.click(await screen.findByRole("button", { name: /حذف العبوة/ }))
    await waitFor(() => expect(deleteVariant).toHaveBeenCalledWith(9))
  })

  it("offers no delete when there is no box yet", async () => {
    show()
    await screen.findByLabelText(/عدد القطع/)
    expect(screen.queryByRole("button", { name: /حذف العبوة/ })).toBeNull()
  })
})
