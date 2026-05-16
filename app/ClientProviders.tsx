"use client"

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TelnyxDeviceProvider } from "@/components/voice/TelnyxDeviceProvider"
import { NotificationsProvider } from "@/hooks/use-notifications"
import { NowProvider } from "@/hooks/use-now"
import useRealtimeNotifications from "@/hooks/use-realtime-notifications"
import { SessionProvider } from "@/hooks/use-session"
import { usePathname } from "next/navigation"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            retryDelay: 1000,
          },
        },
      }),
  )

  useRealtimeNotifications()

  const isAgentPage = pathname?.startsWith("/agents")

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <SessionProvider>
            <NowProvider>
              {isAgentPage ? (
                children
              ) : (
                <TelnyxDeviceProvider>{children}</TelnyxDeviceProvider>
              )}
              <Toaster richColors position="top-right" />
            </NowProvider>
          </SessionProvider>
        </NotificationsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
