"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getUserMergeContext, type UserMergeContext } from "@/lib/user-context"
import { useSession } from "./use-session"

const EMPTY_CONTEXT: UserMergeContext = { myFirstName: "", myLastName: "" }

export function useMyMergeContext(): UserMergeContext {
  let user
  try {
    ;({ user } = useSession())
  } catch {
    user = null
  }
  const [context, setContext] = useState<UserMergeContext>(EMPTY_CONTEXT)

  useEffect(() => {
    let mounted = true

    if (!user) {
      setContext(EMPTY_CONTEXT)
      return () => {
        mounted = false
      }
    }

    getUserMergeContext(supabase, user.id)
      .then((nextContext) => {
        if (mounted) setContext(nextContext)
      })
      .catch((error) => {
        console.error("User merge context lookup failed", error)
        if (mounted) setContext(EMPTY_CONTEXT)
      })

    return () => {
      mounted = false
    }
  }, [user])

  return context
}
