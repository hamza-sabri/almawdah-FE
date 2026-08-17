import colormixFallback from "./postcss-colormix-fallback.mjs"

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    // Tailwind first (emits the modern CSS)…
    "@tailwindcss/postcss",
    // …then add color-mix() fallbacks for old POS browsers (Chrome < 111).
    colormixFallback(),
  ],
}

export default config
