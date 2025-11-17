"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    (async () => {
      // Handles both email magic link (#access_token…) and PKCE (?code=…)
      await supabase.auth.exchangeCodeForSession(window.location.href)
      const redirect = params.get("redirectedFrom") || "/dashboard"
      router.replace(redirect)
    })()
  }, []) // eslint-disable-line

  return <div className="flex min-h-screen items-center justify-center p-8">Signing you in…</div>
}
