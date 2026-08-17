import { redirect } from "next/navigation"

/**
 * There is no marketing site on this deployment — `/` is the app.
 *
 * Logged out you land on /login; the login page itself bounces an already
 * authenticated session straight to /pos, so both cases resolve here.
 *
 * (The template shipped a landing page guarded by `isCentral()`. That guard
 * can never fire from a Server Component: lib/site.ts documents that
 * currentTenant() returns CENTRAL on the server because only
 * lib/tenant.server.ts can see the Host header. So the guard was inert and
 * every tenant domain rendered the marketing page.)
 */
export default function HomePage() {
  redirect("/login")
}
