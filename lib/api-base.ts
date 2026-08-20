/**
 * Where this deployment's API lives.
 *
 * ONE rule, in ONE place, because getting it wrong is not a bug you notice:
 * a fallback to another tenant's host means this shop's till silently reads
 * and writes ANOTHER SHOP'S DATABASE. Three modules used to carry their own
 * default — two pointed at `alrahmah.store.clinixa.cloud` and one at
 * `api.clinixa.cloud` — so a single missing or misspelled build argument would
 * have handed Al-Mawadda's cashier someone else's products, sales and debts,
 * with nothing on screen to say so.
 *
 * Every store is its own deployment, its own database, its own everything.
 * A value that identifies WHICH store therefore has exactly one legitimate
 * source: this deployment's environment. There is no sensible default, so
 * there is none.
 *
 * Missing → same-origin (""). Requests then fail against this app's own host,
 * loudly and harmlessly, instead of succeeding against a stranger's data.
 * Wrong-and-obvious beats wrong-and-invisible.
 */
const RAW = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim()

if (!RAW && typeof console !== "undefined") {
  // Build-time arg, so this fires once per process — not per request.
  console.error(
    "[config] NEXT_PUBLIC_API_BASE_URL is not set. API calls will be made " +
      "same-origin and will fail. Set it in this deployment's build arguments.",
  )
}

/** Base URL for this deployment's API. "" means same-origin. */
export const API_BASE = RAW.replace(/\/+$/, "")

/** True when the deployment is configured. Handy for health/debug screens. */
export const API_BASE_CONFIGURED = Boolean(RAW)
