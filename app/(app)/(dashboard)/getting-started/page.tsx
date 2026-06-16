"use client"

import { Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import {
  OnboardingChecklist,
  type OnboardingState,
} from "@/components/onboarding/onboarding-checklist"

async function fetchOnboarding(): Promise<OnboardingState> {
  const res = await fetch("/api/onboarding")
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || "Failed to load onboarding")
  }
  return res.json()
}

export default function GettingStartedPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["onboarding"],
    queryFn: fetchOnboarding,
    refetchOnWindowFocus: false,
  })

  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6">
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <OnboardingChecklist state={data} onChanged={() => refetch()} />
        )}
      </div>
    </MainLayout>
  )
}
