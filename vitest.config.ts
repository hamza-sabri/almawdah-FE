import { defineConfig } from "vitest/config"
import path from "node:path"

// Frontend unit/component tests. esbuild handles JSX (no extra plugin needed);
// jsdom gives us a DOM; the `@` alias mirrors tsconfig paths.
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  // Tests don't need CSS. Skip the app's Tailwind v4 postcss.config.mjs, which
  // Vite's PostCSS loader can't parse (it would throw "Invalid PostCSS Plugin").
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
})
