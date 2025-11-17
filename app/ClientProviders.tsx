"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { NowProvider } from "@/hooks/use-now";
import { SessionProvider } from "@/hooks/use-session";
import useRealtimeNotifications from "@/hooks/use-realtime-notifications";
import { TelnyxDeviceProvider } from "@/components/voice/TelnyxDeviceProvider";
import { usePathname } from "next/navigation";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Create a client
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
  );

  useRealtimeNotifications();
  
  // Check if we're on an agent page
  const isAgentPage = pathname?.startsWith('/agents');

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <NowProvider>
            {/* Only load TelnyxDeviceProvider for non-agent pages */}
            {isAgentPage ? (
              children
            ) : (
              <TelnyxDeviceProvider>
                {children}
              </TelnyxDeviceProvider>
            )}
            <Toaster richColors position="top-right" />
          </NowProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
