"use client"

import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  ChevronRight,
  Loader2,
  Mail,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"

import { PermissionGate } from "@/components/auth/PermissionGate"
import { useSession } from "@/hooks/use-session"
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  type PermissionGroup,
} from "@/lib/permissions/keys"
import {
  PERMISSION_TEMPLATES,
  grantsForTemplate,
  type PermissionTemplateId,
} from "@/lib/permissions/templates"
import { cn } from "@/lib/utils"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ApiUser = {
  id: string
  email: string | null
  fullName: string | null
  displayName: string | null
  role: string
  createdAt: string | null
  permissions: string[]
}

const TOTAL_PERMISSIONS = PERMISSION_KEYS.length
const TEMPLATE_CHIPS = PERMISSION_TEMPLATES // admin · manager · agent · viewer · custom

function initialsOf(user: ApiUser): string {
  const source = user.fullName?.trim() || user.email?.trim() || "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function nameOf(user: ApiUser): string {
  return user.fullName?.trim() || user.email?.split("@")[0] || "Unnamed user"
}

/** Returns the template whose grant set exactly matches the user's grants, if any. */
function matchTemplate(permissions: string[]): PermissionTemplateId | null {
  const granted = new Set(permissions)
  for (const template of PERMISSION_TEMPLATES) {
    if (template.id === "custom") continue
    const grants = template.grants
    if (grants.length === granted.size && grants.every((key) => granted.has(key))) {
      return template.id
    }
  }
  return null
}

function accessSummary(user: ApiUser): { label: string; preset: boolean } {
  if (user.role === "admin") return { label: "Full access", preset: true }
  const matched = matchTemplate(user.permissions)
  if (matched) {
    const template = PERMISSION_TEMPLATES.find((entry) => entry.id === matched)
    return { label: template?.label ?? "Custom", preset: true }
  }
  return { label: `Custom · ${user.permissions.length}/${TOTAL_PERMISSIONS}`, preset: false }
}

export default function UsersPage() {
  return (
    <PermissionGate permission="users.manage" title="Team & Permissions">
      <UsersManager />
    </PermissionGate>
  )
}

function UsersManager() {
  const { user: currentUser } = useSession()
  const currentUserId = currentUser?.id ?? null

  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to load users")
      setUsers(data.users ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) => {
      const haystack = `${user.fullName ?? ""} ${user.email ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [users, search])

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  function patchUser(userId: string, patch: Partial<ApiUser>) {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, ...patch } : user)),
    )
  }

  function removeUser(userId: string) {
    setUsers((prev) => prev.filter((user) => user.id !== userId))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Team &amp; Permissions
          </h1>
          <p className="text-sm text-muted-foreground">Manage who can access what.</p>
        </div>
        <Button variant="brand" onClick={() => setInviteOpen(true)} className="shrink-0">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {/* Users table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : filteredUsers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    hasUsers={users.length > 0}
                    onInvite={() => setInviteOpen(true)}
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onOpen={() => setSelectedUserId(user.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={loadUsers}
      />

      <PermissionEditorSheet
        user={selectedUser}
        currentUserId={currentUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null)
        }}
        onPatchUser={patchUser}
        onRemoveUser={(userId) => {
          removeUser(userId)
          setSelectedUserId(null)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table rows                                                          */
/* ------------------------------------------------------------------ */

function UserRow({ user, onOpen }: { user: ApiUser; onOpen: () => void }) {
  const access = accessSummary(user)
  return (
    <TableRow
      onClick={onOpen}
      className="group cursor-pointer transition-colors hover:bg-emerald-50/60"
    >
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
              {initialsOf(user)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{nameOf(user)}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "text-sm",
            access.preset ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {access.label}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {user.createdAt
          ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
          : "—"}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-emerald-600" />
      </TableCell>
    </TableRow>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">
        Admin
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-slate-200 text-slate-600">
      User
    </Badge>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={index} className="hover:bg-transparent">
          <TableCell className="pl-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-14 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-4" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function EmptyState({
  hasUsers,
  onInvite,
}: {
  hasUsers: boolean
  onInvite: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <UsersIcon className="h-6 w-6 text-emerald-600" />
      </div>
      {hasUsers ? (
        <>
          <p className="font-medium text-foreground">No matching teammates</p>
          <p className="text-sm text-muted-foreground">
            Try a different name or email.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium text-foreground">Invite your first teammate</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Add people to your team and control exactly what each of them can do.
          </p>
          <Button variant="brand" onClick={onInvite} className="mt-1">
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Invite dialog                                                       */
/* ------------------------------------------------------------------ */

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: () => void | Promise<void>
}) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("user")
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setEmail("")
    setFullName("")
    setRole("user")
  }

  async function handleSubmit() {
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), fullName: fullName.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send invite")
      toast.success(`Invite sent to ${email.trim()}`)
      reset()
      onOpenChange(false)
      await onInvited()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : (reset(), onOpenChange(false)))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            We&apos;ll email them a secure link to set their own password — no password to share.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jordan Rivera"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admins have unrestricted access. Users start with no permissions until you grant
              them.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Permission editor sheet                                             */
/* ------------------------------------------------------------------ */

function PermissionEditorSheet({
  user,
  currentUserId,
  onOpenChange,
  onPatchUser,
  onRemoveUser,
}: {
  user: ApiUser | null
  currentUserId: string | null
  onOpenChange: (open: boolean) => void
  onPatchUser: (userId: string, patch: Partial<ApiUser>) => void
  onRemoveUser: (userId: string) => void
}) {
  const [applyingTemplate, setApplyingTemplate] = useState<PermissionTemplateId | null>(null)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set())
  const [removeOpen, setRemoveOpen] = useState(false)

  const isSelf = !!user && user.id === currentUserId
  const isAdmin = user?.role === "admin"
  const activeTemplate = user ? matchTemplate(user.permissions) : null

  async function handleRoleChange(role: string) {
    if (!user) return
    if (isSelf && role !== "admin") {
      toast.error("You can't change your own admin role")
      return
    }
    const previousRole = user.role
    onPatchUser(user.id, { role })
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to update role")
      toast.success(`Role updated to ${role === "admin" ? "Admin" : "User"}`)
    } catch (error) {
      onPatchUser(user.id, { role: previousRole })
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  async function handleApplyTemplate(templateId: PermissionTemplateId) {
    if (!user || applyingTemplate) return
    setApplyingTemplate(templateId)
    const nextPermissions = grantsForTemplate(templateId)
    const previousPermissions = user.permissions
    onPatchUser(user.id, { permissions: nextPermissions })
    try {
      const res = await fetch("/api/admin/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, templateId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to apply preset")
      const template = PERMISSION_TEMPLATES.find((entry) => entry.id === templateId)
      toast.success(`Applied ${template?.label ?? "preset"} preset`)
    } catch (error) {
      onPatchUser(user.id, { permissions: previousPermissions })
      toast.error(error instanceof Error ? error.message : "Failed to apply preset")
    } finally {
      setApplyingTemplate(null)
    }
  }

  async function handleToggle(permissionKey: string, granted: boolean) {
    if (!user) return
    const previousPermissions = user.permissions
    const nextPermissions = granted
      ? [...previousPermissions, permissionKey]
      : previousPermissions.filter((key) => key !== permissionKey)
    onPatchUser(user.id, { permissions: nextPermissions })
    setPendingKeys((prev) => new Set(prev).add(permissionKey))
    try {
      const res = await fetch("/api/admin/update-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, permissionKey, granted }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to update permission")
    } catch (error) {
      onPatchUser(user.id, { permissions: previousPermissions })
      toast.error(error instanceof Error ? error.message : "Failed to update permission")
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.delete(permissionKey)
        return next
      })
    }
  }

  async function handleSendReset() {
    if (!user?.email) return
    try {
      const res = await fetch("/api/admin/send-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send reset")
      toast.success(`Password reset sent to ${user.email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset")
    }
  }

  async function handleRemove() {
    if (!user) return
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || "Failed to remove user")
    toast.success("User removed")
    onRemoveUser(user.id)
  }

  const grantedSet = useMemo(
    () => new Set(user?.permissions ?? []),
    [user?.permissions],
  )

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        {user && (
          <>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 border-b bg-background px-6 py-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-700">
                    {initialsOf(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{nameOf(user)}</SheetTitle>
                  <p className="truncate text-sm text-muted-foreground">{user.email ?? "—"}</p>
                </div>
                <div className="w-32 shrink-0">
                  {isSelf ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Select value={user.role} disabled>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          You can&apos;t change your own admin role
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Select value={user.role} onValueChange={handleRoleChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {/* Template presets */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Presets</h3>
                  <p className="text-xs text-muted-foreground">
                    Apply a starting point, then fine-tune below.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_CHIPS.map((template) => {
                    const active = activeTemplate === template.id
                    const busy = applyingTemplate === template.id
                    return (
                      <button
                        key={template.id}
                        type="button"
                        disabled={isAdmin || !!applyingTemplate}
                        onClick={() => handleApplyTemplate(template.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-background text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
                        )}
                      >
                        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                        {template.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Admin banner */}
              {isAdmin && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-emerald-900">
                      Admins have unrestricted access
                    </p>
                    <p className="text-xs text-emerald-700">
                      Individual permissions don&apos;t apply while this person is an admin.
                    </p>
                  </div>
                </div>
              )}

              {/* Permission groups */}
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <PermissionGroupCard
                    key={group}
                    group={group}
                    grantedSet={grantedSet}
                    pendingKeys={pendingKeys}
                    disabled={isAdmin}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>

            {/* Sticky danger zone */}
            <div className="sticky bottom-0 z-10 space-y-3 border-t bg-background px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Danger zone
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleSendReset}
                  disabled={!user.email}
                >
                  <Mail className="h-4 w-4" />
                  Send password reset
                </Button>
                {isSelf ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1">
                          <Button variant="outline" className="w-full" disabled>
                            <Trash2 className="h-4 w-4" />
                            Remove user
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>You can&apos;t remove your own account</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setRemoveOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove user
                  </Button>
                )}
              </div>
            </div>

            <ConfirmDialog
              open={removeOpen}
              onOpenChange={setRemoveOpen}
              title={`Remove ${nameOf(user)}?`}
              description="This permanently deletes their account and access. This action cannot be undone."
              actionText="Remove user"
              destructive
              onConfirm={handleRemove}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PermissionGroupCard({
  group,
  grantedSet,
  pendingKeys,
  disabled,
  onToggle,
}: {
  group: PermissionGroup
  grantedSet: Set<string>
  pendingKeys: Set<string>
  disabled: boolean
  onToggle: (permissionKey: string, granted: boolean) => void
}) {
  const entries = PERMISSION_CATALOG.filter((entry) => entry.group === group)
  if (entries.length === 0) return null

  return (
    <Card className={cn("overflow-hidden transition-opacity", disabled && "opacity-60")}>
      <div className="border-b bg-muted/40 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-foreground">{group}</h4>
      </div>
      <div className="divide-y">
        {entries.map((entry) => {
          const checked = grantedSet.has(entry.key)
          const pending = pendingKeys.has(entry.key)
          return (
            <div
              key={entry.key}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                <p className="text-xs text-muted-foreground">{entry.description}</p>
              </div>
              <Switch
                checked={checked}
                disabled={disabled || pending}
                onCheckedChange={(value) => onToggle(entry.key, value)}
                className="data-[state=checked]:bg-emerald-600"
                aria-label={entry.label}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
