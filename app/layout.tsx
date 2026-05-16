import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import ClientProviders from "./ClientProviders"
import "@/lib/env-check"

export const metadata: Metadata = {
  title: "ListHit - Real Estate Disposition CRM",
  description: "ListHit.io — manage buyers, blast properties, track deals, and close faster.",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
