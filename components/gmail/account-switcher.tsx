"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import ConfirmDialog from "@/components/ui/confirm-dialog"

interface Account {
  id: string
  email: string
  is_active: boolean
}

interface AccountSwitcherProps {
  accounts: Account[]
}

function getInitials(email: string): string {
  return email.substring(0, 2).toUpperCase()
}

function getAvatarColor(email: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-fuchsia-500",
    "bg-orange-500",
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash + email.charCodeAt(i)) % colors.length
  return colors[hash]
}

export default function AccountSwitcher({ accounts }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [pendingDisconnect, setPendingDisconnect] = useState<Account | null>(null)
  const queryClient = useQueryClient()
  const active = accounts.find((a) => a.is_active)
  const inactive = accounts.filter((a) => !a.is_active)

  const handleSwitch = async (accountId: string) => {
    setOpen(false)
    try {
      const res = await fetch(`/api/gmail/accounts/${accountId}/activate`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to switch account")
      toast.success("Account switched")
      queryClient.invalidateQueries({ queryKey: ["gmail-accounts"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
    } catch {
      toast.error("Failed to switch account")
    }
  }

  const handleDisconnectClick = (e: React.MouseEvent, account: Account) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    setPendingDisconnect(account)
  }

  const performDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/gmail/accounts/${accountId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to disconnect")
      toast.success("Account disconnected")
      queryClient.invalidateQueries({ queryKey: ["gmail-accounts"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-labels"] })
    } catch {
      toast.error("Failed to disconnect")
    }
  }

  if (!active) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
              getAvatarColor(active.email),
            )}
          >
            {getInitials(active.email)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{active.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem className="cursor-default py-2" onSelect={(e) => e.preventDefault()}>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white",
              getAvatarColor(active.email),
            )}
          >
            {getInitials(active.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{active.email}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <Check className="h-4 w-4 text-primary" />
        </DropdownMenuItem>

        {inactive.map((acc) => (
          <DropdownMenuItem key={acc.id} className="py-2" onSelect={() => handleSwitch(acc.id)}>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white",
                getAvatarColor(acc.email),
              )}
            >
              {getInitials(acc.email)}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm">{acc.email}</p>
            <button
              onClick={(e) => handleDisconnectClick(e, acc)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Disconnect"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/api/gmail/auth/init" className="cursor-pointer">
            <Plus className="h-4 w-4" />
            <span>Add another account</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ConfirmDialog
        open={pendingDisconnect !== null}
        onOpenChange={(o) => !o && setPendingDisconnect(null)}
        destructive
        title="Disconnect account?"
        description={
          pendingDisconnect
            ? `${pendingDisconnect.email} will be disconnected from ListHit.`
            : undefined
        }
        actionText="Disconnect"
        onConfirm={async () => {
          if (pendingDisconnect) await performDisconnect(pendingDisconnect.id)
        }}
      />
    </DropdownMenu>
  )
}
