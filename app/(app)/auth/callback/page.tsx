"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

// Only same-origin, path-relative redirects. Browsers treat "//evil.com" and
// "/\evil.com" as protocol-relative URLs, so those are open redirects, not paths.
function safeRedirect(value: string | null): string {
  if (!value) return "/dashboard"
  if (!value.startsWith("/")) return "/dashboard"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/dashboard"
  return value
}

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    (async () => {
      // Handles both email magic link (#access_token…) and PKCE (?code=…)
      await supabase.auth.exchangeCodeForSession(window.location.href)
      router.replace(safeRedirect(params.get("redirectedFrom")))
    })()
  }, []) // eslint-disable-line

  return <div className="flex min-h-screen items-center justify-center p-8">Signing you in…</div>
}
