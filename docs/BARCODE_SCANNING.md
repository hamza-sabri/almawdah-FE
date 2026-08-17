# Barcode scanning — architecture & invariants

> **Status: WORKING — verified in the field (2026-07-10, build م8).**
> This design was reached after a full day of measurement and field
> debugging. Every rule below exists because violating it demonstrably
> broke scanning in a real store. **Read this before touching
> `lib/scan/decoder.ts`, `components/scan/inline-scanner.tsx`, or
> `components/scan/scan-dialog.tsx`.**

## The five invariants (do not regress)

### 1. NEVER prefer the platform's native `BarcodeDetector`
`createDetector()` always returns the **ZXing-WASM ponyfill**
(`barcode-detector/ponyfill`). On several Android builds the native
detector constructs successfully but **silently returns zero results for
every frame** (broken/missing Google Play Services ML Kit module). There
is no API to distinguish "broken detector" from "no barcode in view", so
any native-first strategy silently disables scanning on those phones.
Field-verified: barcodestalk.com's scanner reads instantly on a phone
where the native path found nothing — their code loads
`barcode-detector@3`'s *polyfill* build, which unconditionally replaces
the native detector. Same engine everywhere = identical behavior on
Android Chrome, iOS Safari, installed PWAs, and in-app webviews
(Telegram/WhatsApp).

### 2. The scan loop is rAF-chained, not timer-based
The next detect attempt starts as soon as the previous one finishes
(`requestAnimationFrame`-paced pump). A fixed 120 ms interval plus heavy
per-frame work had collapsed the effective scan rate to ~2–5 attempts/s;
live scanning quality is dominated by **attempts per second**, because
each attempt sees a fresh (possibly sharper) frame.

### 3. Heavy passes are interleaved, never every frame
Per attempt: ZXing full-frame (fast, every attempt). Only on
`attempt % 4 === 1`: ZBar full-frame. Only on `attempt % 4 === 3`:
center-crop ×2/×3 upscale through both engines. This keeps the primary
loop fast on weak devices while ZBar still gets multiple shots per second.

### 4. ZBar stays in the cascade
Measured on our real store labels (13-digit Code-128 from the Hesabate
label printer): ZXing needs **≥300 px** of symbol width in the frame;
**ZBar reads at ~180–200 px** — the difference between "reads at normal
aiming distance" and "won't read at all". ZBar is vendored at
`public/vendor/zbar-wasm-0.11.0.mjs` (self-contained, WASM inlined,
runtime-imported so no bundler config). If it fails to load, the cascade
degrades gracefully to ZXing. To upgrade: copy
`node_modules/@undecaf/zbar-wasm/dist/inlined/index.mjs` to a new
versioned filename and update `ZBAR_URL` in `decoder.ts`.

### 5. Format list and validation are deliberate
`SCAN_FORMATS = ean_13, ean_8, upc_a, upc_e, code_128` — **never add
`code_39` or `itf`**: they made ZXing misread EAN fragments as letters
and `*+%` garbage, which the app then accepted. Validation
(`isValidProductBarcode`) is format-aware: digits-only always; EAN
checksum enforced ONLY for ean_13/ean_8/upc_a. Store shelf labels are
Code-128 with arbitrary digits and **fail the EAN checksum by design** —
checksum-gating them was the original "won't scan" bug. `upc_e` is
exempt too (its check digit belongs to the expanded UPC-A form).

## Supporting design

- **2-read confirmation gate** (`createScanGate`, window 2000 ms): a code
  is accepted after two identical decodes. All enabled formats are
  self-checksummed, so this is belt-and-suspenders against misreads
  without hurting hard barcodes (sporadic reads 1.5 s apart still count).
- **One code offered per frame** (first valid): a second symbol or
  garbage read in frame must not churn/reset the gate candidate.
- **Green hit box**: drawn the moment any engine sees a code
  (pre-confirmation), mapped through the object-cover transform
  (`frameBoxToDisplay`), mirrored-preview aware.
- **Zoom slider**: shown when the camera supports zoom (capped ×8),
  default ×1. Do NOT force a default zoom — digital zoom blurs on some
  devices.
- **Camera profile**: 1920×1080 ideal, continuous focus. Higher requests
  slow per-frame decode more than they help.
- **Photo fallback** (camera button, both scanners): native-camera still
  (tap-to-focus, full sensor) decoded through both engines at descending
  scales. Measured: labels that need ≥300 px in video decode from photos
  even blurred, tilted 12°, JPEG-compressed. This is the guaranteed path
  for stubborn/worn labels and webviews with crippled cameras.
- **Manual entry**: last resort, digits are printed under every barcode.

## The viewfinder badge (support tool)

Bottom corner shows `SCANNER_BUILD · captureWidth×captureHeight`
(e.g. `م8 · 1920×1080`). **Bump `SCANNER_BUILD` on every scanner
change** — PWA service-worker caching makes "which build is this phone
actually running?" genuinely ambiguous, and this badge settles it in one
glance. A low resolution (e.g. 640×480) means the browser/webview is
starving the camera → use the photo button on that device.

## Field test protocol (run after any scanner change)

1. Deploy, then fully close and reopen the PWA **twice**; confirm the
   badge shows the new build id.
2. Test the three known-hard store labels (dense 13-digit Code-128 on
   small thermal stickers — "silicon 6set", "best toys", "Toys giraffa"
   photos in the ClickUp task) plus a few manufacturer EAN-13 products.
3. Test on: Android Chrome, installed PWA, iOS Safari, and one in-app
   webview (Telegram). Behavior must be consistent (invariant 1).
4. Verify no misreads: scanned digits must exactly match the printed
   digits under the barcode.

## History / evidence (short)

- Old bug #1: EAN checksum applied to any 13-digit code → rejected the
  store's own Code-128 labels even on perfect decodes.
- Old bug #2: non-numeric codes skipped validation → letter/symbol
  misreads (from code_39/itf) were accepted into the catalog.
- Old bug #3: native-first engine selection → scanning silently dead on
  phones with a broken ML Kit module.
- Old bug #4: 120 ms timer + heavyweight multi-pass every tick → ~2–5
  effective attempts/s, "wiggle until it reads" UX.
- Engine benchmark (bwip-js generated real label values, degraded, run
  through the real engines): ZXing floor ~300 px, ZBar floor ~180 px,
  zero misreads from either at any size. JPEG artifacts are harmless at
  photo resolutions.
- Reference implementation studied: barcodestalk.com/free-online-barcode-scanner
  (barcode-detector@3 polyfill build + rAF loop + zoom slider; decoding
  fully client-side).

## Long-term recommendation (upstream fix)

The store prints its own shelf labels. 13 dense digits on a ~3 cm thermal
sticker sits at the physical edge of what ANY phone camera decodes.
Printing wider barcodes (or taller bars, or shorter internal codes) at
the label printer permanently removes the hardest cases. Manufacturer
EAN-13 barcodes are comfortably inside every margin.
