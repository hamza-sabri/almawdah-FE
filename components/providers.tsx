"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
            // Our customFetch handles offline itself (serves local cached +
            // queued data). Without this, React Query v5 PAUSES queries when
            // navigator.onLine is false and never calls the fetcher — so the
            // Sales page (and every page) would hang offline instead of
            // rendering local data.
            networkMode: "always",
          },
          mutations: {
            networkMode: "always",
          },
        },
      }),
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}
