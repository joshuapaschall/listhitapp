import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import ClientProviders from "./ClientProviders"
import "@/lib/env-check"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DispoTool - Real Estate Disposition Management",
  description: "Real estate disposition tool for managing buyers, properties, and deals",
    generator: "v0.dev"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
