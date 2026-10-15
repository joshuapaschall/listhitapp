"use client"

import { Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { OnboardingChecklist, type SetupSummary } from "@/components/onboarding/onboarding-checklist"

async function fetchOnboarding(): Promise<SetupSummary> {
  const res = await fetch("/api/onboarding")
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || "Failed to load your setup")
  }
  return res.json()
}

export default function GettingStartedPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["onboarding"],
    queryFn: fetchOnboarding,
    refetchOnWindowFocus: true,
  })

  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        {isError ? (
          <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
            We couldn&apos;t load your setup.{" "}
            <button type="button" onClick={() => refetch()} className="font-semibold text-brand hover:underline">
              Try again
            </button>
          </div>
        ) : isLoading || !data ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <OnboardingChecklist state={data} />
        )}
      </div>
    </MainLayout>
  )
}
