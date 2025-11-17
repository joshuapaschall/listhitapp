"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useSession } from "./use-session"

export default function usePermission(key: string) {
  const { user } = useSession()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!user) {
      setAllowed(false)
      return
    }
    supabase
      .from("permissions")
      .select("granted")
      .eq("user_id", user.id)
      .eq("permission_key", key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Permission lookup failed", error)
          setAllowed(false)
        } else {
          setAllowed(data?.granted ?? false)
        }
      })
  }, [user, key])

  return allowed
}
