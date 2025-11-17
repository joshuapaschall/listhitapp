"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useSession } from "./use-session"

export default function useUserRole() {
  let user
  try {
    ;({ user } = useSession())
  } catch {
    user = null
  }
  const [role, setRole] = useState("user")

  useEffect(() => {
    if (!user) {
      setRole("user")
      return
    }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Role lookup failed", error)
          setRole("user")
        } else {
          setRole(data?.role ?? "user")
        }
      })
  }, [user])

  return role
}
