"use client"

import Link from "next/link"
import { Suspense, type FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { useToast } from "@/hooks/use-toast"
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password-policy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"

type Phase = "verifying" | "ready" | "expired"

function SetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const tokenHash = params.get("token_hash")
  const linkType = params.get("type") === "recovery" ? "recovery" : "invite"

  const [phase, setPhase] = useState<Phase>("verifying")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    const start = async () => {
      if (tokenHash) {
        // Verifying here (rather than letting Supabase redirect) keeps the flow
        // independent of the project's redirect allow-list.
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: linkType,
        })
        if (!active) return
        setPhase(error ? "expired" : "ready")
        return
      }

      // No token: this is the must-change-password redirect, so an existing
      // session is required.
      const { data } = await supabase.auth.getSession()
      if (!active) return
      if (!data.session) {
        router.replace("/login")
        return
      }
      setPhase("ready")
    }

    void start()

    return () => {
      active = false
    }
  }, [linkType, router, supabase, tokenHash])

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const policyError = validatePassword(password)
    if (policyError) {
      setError(policyError)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Show the server's own message — it says which condition failed.
        setError(data?.error || "Could not set your password.")
        setIsSubmitting(false)
        return
      }
      // usePermissions caches must_change_password for 60s. Without this
      // invalidation PasswordChangeGuard reads the stale `true` and bounces the
      // user straight back here.
      await queryClient.invalidateQueries({ queryKey: ["permissions"] })
      toast({ title: "Password set", description: "You're all set." })
      router.replace("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set your password.")
      setIsSubmitting(false)
    }
  }

  if (phase === "verifying") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your link…
        </CardContent>
      </Card>
    )
  }

  if (phase === "expired") {
    return (
      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">This link has expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Invite and password-reset links can only be used once, and they stop working a
            short time after they&apos;re sent.
          </p>
          <p>Ask an admin on your team to send you a new one.</p>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold">Set your password</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a password to finish setting up your account
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2 text-left">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters
            </p>
          </div>
          <div className="space-y-2 text-left">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              disabled={isSubmitting}
            />
            {mismatch ? (
              <p className="text-xs text-destructive">Passwords don&apos;t match</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Set password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <Suspense
          fallback={
            <Card>
              <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </CardContent>
            </Card>
          }
        >
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
