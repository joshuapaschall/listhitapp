import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import "@/lib/env-check"

export const metadata: Metadata = {
  title: "ListHit",
}

// Bare root: just <html>/<body> + global styles + env validation. App fonts and
// every client provider now live in app/(app)/layout.tsx, so public tenant sites
// (app/sites) and other public routes inherit none of the CRM runtime.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
