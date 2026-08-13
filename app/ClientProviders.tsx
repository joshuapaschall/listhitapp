"use client"

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { CallProvider } from "@/components/voice/CallProvider"
import { NotificationsProvider } from "@/hooks/use-notifications"
import { NowProvider } from "@/hooks/use-now"
import PasswordChangeGuard from "@/components/auth/PasswordChangeGuard"
import useRealtimeNotifications from "@/hooks/use-realtime-notifications"
import { SessionProvider } from "@/hooks/use-session"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
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
              {/* Inside SessionProvider, outside CallProvider: a user who still
                  owes us a password should not provision telephony first. */}
              <PasswordChangeGuard>
                <CallProvider>{children}</CallProvider>
              </PasswordChangeGuard>
              <Toaster richColors position="top-right" />
            </NowProvider>
          </SessionProvider>
        </NotificationsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
