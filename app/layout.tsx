import type React from "react"
import type { Metadata } from "next"
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import ClientProviders from "./ClientProviders"
import "@/lib/env-check"

const fontSans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" })
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap" })

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
    <html lang="en" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="font-sans">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
