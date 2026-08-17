/* eslint-disable @typescript-eslint/no-explicit-any */
import "@testing-library/jest-dom/vitest"

// jsdom lacks a few DOM APIs that Base UI / floating components touch. Stub them
// so component tests (e.g. the dropdown menu) can render without throwing.
if (!window.matchMedia) {
  ;(window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver ||= RO
;(Element.prototype as any).scrollIntoView ||= () => {}
;(Element.prototype as any).hasPointerCapture ||= () => false
;(Element.prototype as any).setPointerCapture ||= () => {}
;(Element.prototype as any).releasePointerCapture ||= () => {}
