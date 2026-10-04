"use client"

import { type FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/hooks/use-session"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function CreateOrgPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const { hasOrg } = usePermissions()

  const [name, setName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // Seed from the metadata captured at signup. Guarded so it only runs once and
  // never stomps what the user has started typing.
  useEffect(() => {
    if (prefilled || !user) return
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const metaName =
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.display_name === "string" && meta.display_name) ||
      ""
    const metaCompany = typeof meta.company_name === "string" ? meta.company_name : ""
    setName((current) => current || metaName)
    setCompanyName((current) => current || metaCompany)
    setPrefilled(true)
  }, [prefilled, user])

  // Already onboarded (or an invited teammate who landed here) — nothing to do.
  useEffect(() => {
    if (hasOrg) router.replace("/dashboard")
  }, [hasOrg, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch("/api/onboarding/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Could not create your workspace.")
        setIsSubmitting(false)
        return
      }

      // usePermissions caches org_id for 60s, and OrgRequiredGuard reads it. Without
      // this invalidation the guard bounces the user straight back to onboarding.
      await queryClient.invalidateQueries({ queryKey: ["permissions"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      router.replace("/getting-started")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your workspace.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Create your workspace</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is your company&apos;s private ListHit account. You&apos;ll invite your
              team next.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2 text-left">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  autoComplete="organization"
                  required
                  disabled={isSubmitting}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  "Create workspace"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
