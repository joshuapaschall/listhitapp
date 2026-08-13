"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/use-permissions"

// Where a user who must change their password is still allowed to be.
const EXEMPT_PREFIXES = ["/set-password", "/login", "/signup", "/auth/"]

function isExempt(pathname: string | null): boolean {
  if (!pathname) return true
  return EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Pushes a user with `must_change_password` to /set-password before they can use
 * the app.
 *
 * While the permission query is still resolving this renders children unchanged.
 * That fail-open is deliberate: every API route enforces access server-side, so
 * a brief window of visible UI is cosmetic, whereas failing closed on a slow
 * query would lock out the entire app.
 */
export default function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { loading, mustChangePassword } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()

  const shouldRedirect = !loading && mustChangePassword && !isExempt(pathname)

  useEffect(() => {
    if (shouldRedirect) router.replace("/set-password")
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
