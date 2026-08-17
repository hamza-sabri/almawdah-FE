import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Alexandria } from 'next/font/google'
import { Clarity } from '@/components/clarity'
import { Providers } from '@/components/providers'
import { SwRegister } from '@/components/offline/sw-register'
import { brandingIconUrl, fetchBranding } from '@/lib/branding'
import { TENANT_ATTR } from '@/lib/site'
import { currentSlug } from '@/lib/tenant.server'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const arabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
})

const heading = Alexandria({
  variable: '--font-heading-arabic',
  subsets: ['arabic', 'latin'],
  weight: ['500', '600', '700', '800'],
})

const mono = IBM_Plex_Mono({
  variable: '--font-mono-latin',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

// White-labelled per tenant: tab title, icons, and the iOS install name all
// carry the store's own brand (the deployment default when unset).
// Fetched with ISR — refreshed hourly, safe default if the backend is
// unreachable (e.g. during the Docker build).
export async function generateMetadata(): Promise<Metadata> {
  // Server-side there is no <html> to read the tenant from — take it from the
  // Host header, or every store gets the generic brand.
  const slug = await currentSlug()
  const branding = await fetchBranding({ slug })
  const name = branding?.name?.trim() || 'المودة'
  const hasLogo = Boolean(branding?.logo)
  return {
    title: `${name} — لوحة التحكم`,
    description: 'نظام إدارة المنتجات والزبائن والديون للمتجر',
    generator: 'v0.app',
    // The manifest is a dynamic route (per-tenant name + icons).
    manifest: '/manifest.webmanifest',
    icons: {
      icon: hasLogo
        ? [
            { url: brandingIconUrl(192, false, slug), sizes: '192x192', type: 'image/png' },
            { url: brandingIconUrl(512, false, slug), sizes: '512x512', type: 'image/png' },
          ]
        : [
            { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
      apple: hasLogo ? brandingIconUrl(192, false, slug) : '/apple-touch-icon.png',
    },
    // iOS "add to home screen" opens full-screen like a native app.
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: 'black-translucent',
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#201f38',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Resolve the store from the Host header ONCE, here, and stamp it on
  // <html>. Every client component reads it from the DOM (lib/site.ts) rather
  // than parsing the URL again, so there is exactly one answer per request to
  // "which store is this?" — no build arg, no drift between server and
  // client, and adding a store needs no rebuild.
  const slug = await currentSlug()

  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      {...{ [TENANT_ATTR]: slug }}
      className={`${arabic.variable} ${heading.variable} ${mono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <SwRegister />
        <Toaster position="top-center" richColors />
        {/* Vercel Analytics removed: this deploys to a Hostinger VPS behind
            Traefik, so its script had no collector to talk to — a dead request
            on every page load, on a till that is often on a weak connection.
            Clarity is the analytics for this deployment. */}
        {process.env.NODE_ENV === 'production' && <Clarity />}
      </body>
    </html>
  )
}
