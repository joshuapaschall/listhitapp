"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Session, User } from "@supabase/supabase-js"

interface SessionContextValue {
  session: Session | null
  user: User | null
  loading: boolean
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Only update state when the user IDENTITY actually changes. Supabase fires
    // TOKEN_REFRESHED / SIGNED_IN on tab focus with a fresh-but-identical user
    // object; reacting to those cascades through usePermissions and re-triggers
    // the full-screen loader. Gating on user id keeps the reference stable.
    const applyAuth = (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null
      setUser((prev) => (prev?.id !== nextUser?.id ? nextUser : prev))
      setSession((prev) => (prev?.user?.id !== nextUser?.id ? nextSession : prev))
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      applyAuth(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return
      applyAuth(s)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) return { session: null, user: null, loading: false }
  return ctx
}
