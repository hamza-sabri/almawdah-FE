<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Barcode scanning

Before changing ANYTHING under `lib/scan/` or `components/scan/`, read
`docs/BARCODE_SCANNING.md`. It documents hard-won invariants (engine
choice, loop design, format list, validation rules) that were each the
root cause of a production "scanner doesn't work" incident. Bump
`SCANNER_BUILD` in `lib/scan/decoder.ts` on every scanner change.
