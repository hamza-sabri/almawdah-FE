# Rahma Design System — "Indigo & Lime" (v1)

Design language for صيدلية الرحمة admin, distilled from 5 store UI references
(Pharmalink, DOZ Contacts, SmartPharma Inventory, mint Store app, Phermo Orders).

## Principles
1. **Floating, super-rounded surfaces** — white cards (radius 20–24px) hover above a
   softly tinted lavender canvas. No flat hairline boxes.
2. **Ink contrast moments** — deep navy-ink panels (hero, sidebar, primary CTAs)
   give the light UI drama. Lime is the electric accent that only appears on ink
   or as a status/highlight — never as large fills on white.
3. **Pills everywhere** — chips, filters, statuses, inputs and buttons are
   pill/rounded-2xl. Status = soft tinted pill (mint=paid, amber=unpaid).
4. **Data with personality** — KPI cards with gradient icon chips + trend badges,
   rounded gradient bars, donut with center total, avatar-first table rows,
   colored soft-square action buttons (Phermo style).
5. **Depth & motion** — layered indigo-tinted shadows, GSAP staggered entrances,
   count-ups, hover lifts, Three.js floating-pills scenes on login + dashboard hero.
6. **Forms are small** — compact modals, 44px inputs, 2-col grids, only essential
   fields visible; barcode scan button wherever a product can be entered.

## Tokens
| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.97 0.012 290)` lavender `#F5F4FB` | app canvas |
| `--foreground` / `--ink` | `oklch(0.26 0.045 284)` `#201F38` | text, ink panels |
| `--primary` | `oklch(0.55 0.21 277)` indigo `#5B5CE2` | CTAs, active nav, links |
| `--violet` (`--chart-2`) | `oklch(0.6 0.21 293)` `#7C5CFC` | gradient partner |
| `--lime` | `oklch(0.92 0.2 122)` `#D8F55A` | accent on ink, highlights |
| `--success` | `oklch(0.72 0.14 166)` mint | paid / positive |
| `--warning` | `oklch(0.78 0.15 75)` amber | unpaid / attention |
| `--destructive` | `oklch(0.64 0.21 25)` | delete / danger |
| `--radius` | `1rem` (cards use 1.25–1.5rem) | |

Charts: indigo → violet → sky → mint → amber.

## Type
- Headings: **Alexandria** (700/800) — geometric, modern Arabic.
- Body/UI: **IBM Plex Sans Arabic** (400–700). Numbers: `tabular-nums`.

## Key utilities (globals.css)
`.ink-panel` dark hero surface with indigo/lime glows · `.icon-chip` gradient icon
square · `.pill` base chip · `.pill-success/.pill-warning/.pill-danger/.pill-neutral`
status pills · `.card-interactive` hover lift · `.surface-glass` frosted chrome ·
`.text-gradient` indigo→violet headline.

## Signature components
- **Sidebar**: floating ink rounded-3xl rail (inset from edges), active item =
  indigo gradient pill + lime dot; brand lockup on ink.
- **Top bar**: transparent glass, page greeting, global search pill, scan button.
- **Dashboard hero**: ink-panel with greeting, outstanding-total headline (lime),
  Three.js floating pills on the far side.
- **Tables**: avatar cell, status pill, soft-square action icons (view/edit/delete
  = indigo/mint/red tinted squares).
- **Scan**: `ScanDialog` (BarcodeDetector + zxing ponyfill), scan icon inside
  search inputs and the debt form's product picker.
