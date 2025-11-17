"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { useToast } from "@/hooks/use-toast"
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

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error) {
        console.error("Failed to fetch session", error)
      }
      setSession(data.session ?? null)
      setIsCheckingSession(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: error.message,
      })
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        {session ? (
          <Card>
            <CardHeader>
              <CardTitle>You are already signed in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Session is active for:</p>
              <p className="font-mono text-base text-foreground">{session.user.id}</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => router.push("/dashboard")}> 
                Go to dashboard
              </Button>
            </CardFooter>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your email and password to continue
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={isSubmitting || isCheckingSession}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting || isCheckingSession}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || isCheckingSession}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
