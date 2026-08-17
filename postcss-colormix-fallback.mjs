/**
 * Old-browser fallback for color-mix() (Chrome/Edge < 111, the ceiling on
 * Windows 7/8 POS machines). Tailwind v4 emits opacity utilities like
 * `color-mix(in oklab, var(--primary) 10%, transparent)`. Browsers that can't
 * parse color-mix() DROP the whole declaration, so those elements render with
 * no color — text and icon chips "disappear".
 *
 * This adds a preceding fallback declaration using the SOLID base color (the
 * alpha is lost, but the element stays visible). Modern browsers still get the
 * real color-mix() because it comes second and wins.
 */
const COLORMIX_ALPHA =
  /color-mix\(\s*in\s+[\w-]+\s*,\s*(.+?)\s+[\d.]+%\s*,\s*transparent\s*\)/gi

function toSolid(value) {
  // Replace every "<color> N%, transparent" mix with just <color>.
  return value.replace(COLORMIX_ALPHA, (_m, color) => color.trim())
}

const plugin = () => ({
  postcssPlugin: "colormix-fallback",
  Declaration(decl) {
    const v = decl.value
    if (!v.includes("color-mix(")) return
    if (decl.raws.__cmFallback) return
    const solid = toSolid(v)
    if (solid === v || solid.includes("color-mix(")) return // nothing safely resolved
    const fallback = decl.clone({ value: solid })
    fallback.raws.__cmFallback = true
    decl.before(fallback)
  },
})
plugin.postcss = true

export default plugin
