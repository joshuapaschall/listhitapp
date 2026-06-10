"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { Card } from "@/components/ui/card"

export default function VerifyBusinessPage() {
  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Link
            href="/getting-started"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to setup
          </Link>
          <Card className="border-border p-6">
            <h1 className="text-lg font-semibold text-foreground">Verify your business</h1>
            <p className="mt-2 text-sm text-muted-foreground">We&apos;re building this step next.</p>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}
