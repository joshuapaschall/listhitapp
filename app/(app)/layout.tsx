import type React from "react"
import type { Metadata } from "next"
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google"
import ClientProviders from "../ClientProviders"

const fontSans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" })
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap" })

export const metadata: Metadata = {
  title: "ListHit - Real Estate Disposition CRM",
  description: "ListHit.io — manage buyers, blast properties, track deals, and close faster.",
}

// Authenticated-app shell: app fonts + every client provider. Applied via a
// display:contents wrapper so it adds no layout box (height/flex chains from
// <body> are preserved) while still cascading the font variables + font-sans to
// descendants. Public routes live outside this group and inherit none of it.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontSans.variable} ${fontMono.variable} font-sans`} style={{ display: "contents" }}>
      <ClientProviders>{children}</ClientProviders>
    </div>
  )
}
