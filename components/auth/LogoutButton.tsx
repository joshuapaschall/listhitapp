"use client"

import { useMemo, useState } from "react"
import type { MouseEvent, ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button, type ButtonProps } from "@/components/ui/button"

interface LogoutButtonProps extends ButtonProps {
  children?: ReactNode
}

export function LogoutButton({
  children = "Log out",
  className,
  disabled,
  onClick,
  ...props
}: LogoutButtonProps) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Failed to sign out", error)
      setIsSigningOut(false)
      return
    }

    window.location.href = "/login"
  }

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || isSigningOut) {
      return
    }

    setIsSigningOut(true)
    await handleLogout()
  }

  return (
    <Button
      type="button"
      className={className}
      disabled={Boolean(disabled) || isSigningOut}
      onClick={handleClick}
      {...props}
    >
      {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  )
}
