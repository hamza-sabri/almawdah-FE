export const COLOR_KEY = "اللون"
export const SIZE_KEY = "الحجم"
export const OPTION_PRESETS = [COLOR_KEY, SIZE_KEY, "النكهة", "النوع", "الوزن"]

export const COLOR_PRESETS = [
  { name: "أحمر", hex: "#ef4444" },
  { name: "أخضر", hex: "#22c55e" },
  { name: "أزرق", hex: "#3b82f6" },
  { name: "بنفسجي", hex: "#a855f7" },
  { name: "بني", hex: "#92400e" },
]

export const SIZE_PRESETS = ["S", "M", "L", "XL", "XXL"]

export function colorHexOf(value: string): string | undefined {
  const t = (value ?? "").trim()
  if (!t) return undefined
  if (t.startsWith("#")) return t
  return COLOR_PRESETS.find((c) => c.name === t)?.hex
}
