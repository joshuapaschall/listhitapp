"use client"

import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"

import { supabaseBrowser } from "@/lib/supabase-browser"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SessionDetails {
  hasSession: boolean
  userId: string | null
}

export default function SessionDebugPage() {
  const isProduction = process.env.NODE_ENV === "production"
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({
    hasSession: false,
    userId: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isProduction) {
      console.warn("/dev/session is disabled in production")
      return
    }

    let active = true

    const fetchSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        console.error("Failed to fetch session", error)
        setError(error.message)
      }

      const session: Session | null = data.session ?? null
      setSessionDetails({
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      })
      setIsLoading(false)
    }

    fetchSession()

    return () => {
      active = false
    }
  }, [isProduction, supabase])

  if (isProduction) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Session Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">hasSession</span>
            <span className="font-mono text-base text-foreground">
              {isLoading ? "loading" : String(sessionDetails.hasSession)}
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="font-medium text-muted-foreground">userId</span>
            <span className="break-all font-mono text-base text-foreground">
              {isLoading ? "loading" : sessionDetails.userId ?? "null"}
            </span>
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 p-2 text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
