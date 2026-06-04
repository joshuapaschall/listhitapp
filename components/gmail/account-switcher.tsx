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
import { ArrowLeftRight, Check, ChevronDown, Plus, RefreshCw, Unlink } from "lucide-react"
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

function RowAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string
  onClick: (e: React.MouseEvent) => void
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick(e)
      }}
      className={cn(
        "rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:outline-none",
        destructive && "hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive",
      )}
    >
      {children}
    </button>
  )
}

export default function AccountSwitcher({ accounts }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [pendingDisconnect, setPendingDisconnect] = useState<Account | null>(null)
  const queryClient = useQueryClient()
  const active = accounts.find((a) => a.is_active)

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

  const handleReconnect = (email: string) => {
    setOpen(false)
    window.location.href = `/api/gmail/auth/init?login_hint=${encodeURIComponent(email)}`
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

  // Active first, then the rest — a single, consistent list.
  const ordered = [...accounts].sort((a, b) => Number(b.is_active) - Number(a.is_active))

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
      <DropdownMenuContent align="start" className="w-80">
        {ordered.map((acc) => (
          <DropdownMenuItem
            key={acc.id}
            className="group gap-2 py-2"
            onSelect={(e) => {
              if (acc.is_active) {
                // Active row body click is a no-op; its actions handle reconnect/disconnect.
                e.preventDefault()
              } else {
                handleSwitch(acc.id)
              }
            }}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                getAvatarColor(acc.email),
              )}
            >
              {getInitials(acc.email)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{acc.email}</p>
              {acc.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" />
                  Active
                </span>
              ) : (
                <span className="text-xs text-muted-foreground transition-opacity group-hover:text-foreground">
                  Switch to this account
                </span>
              )}
            </div>

            {/* Per-row actions — reserved space (no layout shift), revealed on hover/focus. */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
              {!acc.is_active && (
                <RowAction label={`Switch to ${acc.email}`} onClick={() => handleSwitch(acc.id)}>
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </RowAction>
              )}
              <RowAction label={`Reconnect ${acc.email}`} onClick={() => handleReconnect(acc.email)}>
                <RefreshCw className="h-3.5 w-3.5" />
              </RowAction>
              <RowAction label={`Disconnect ${acc.email}`} destructive onClick={(e) => handleDisconnectClick(e, acc)}>
                <Unlink className="h-3.5 w-3.5" />
              </RowAction>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/api/gmail/auth/init" className="cursor-pointer gap-2 py-2">
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
