"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/use-permissions"

// Where a user who has no organization yet is still allowed to be.
const EXEMPT_PREFIXES = ["/onboarding", "/set-password", "/login", "/signup", "/auth/"]

function isExempt(pathname: string | null): boolean {
  if (!pathname) return true
  return EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Pushes a user with no `org_id` to /onboarding/create-org. Interactive requests
 * now fail closed without an org, so the app is unusable until one exists.
 *
 * Same fail-open as PasswordChangeGuard: while the permission query is still
 * resolving (or before a profile row is in hand) this renders children
 * unchanged. Every API route enforces tenancy server-side, so a brief window of
 * visible UI is cosmetic, whereas failing closed on a slow query would bounce
 * users who do have an org straight into onboarding.
 *
 * Password change wins: a user who owes us a password goes there first.
 */
export default function OrgRequiredGuard({ children }: { children: React.ReactNode }) {
  const { loading, hasOrg, profileLoaded, mustChangePassword } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()

  const shouldRedirect =
    !loading && !mustChangePassword && profileLoaded && !hasOrg && !isExempt(pathname)

  useEffect(() => {
    if (shouldRedirect) router.replace("/onboarding/create-org")
  }, [router, shouldRedirect])

  if (shouldRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting…
      </div>
    )
  }

  return <>{children}</>
}
