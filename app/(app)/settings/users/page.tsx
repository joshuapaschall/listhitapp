"use client"

import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"

import { PermissionGate } from "@/components/auth/PermissionGate"
import { useSession } from "@/hooks/use-session"
import {
  MIN_PASSWORD_LENGTH,
  generatePassword,
  validatePassword,
} from "@/lib/auth/password-policy"
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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  mustChangePassword: boolean
  invitedAt: string | null
  lastSignInAt: string | null
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

function isAdminRole(role: string): boolean {
  return role === "admin" || role === "owner"
}

function accessSummary(user: ApiUser): { label: string; preset: boolean } {
  if (isAdminRole(user.role)) return { label: "Full access", preset: true }
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
              <TableHead>Status</TableHead>
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
                <TableCell colSpan={6} className="p-0">
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
      className="group cursor-pointer transition-colors hover:bg-muted"
    >
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
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
        <StatusBadge user={user} />
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
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
      </TableCell>
    </TableRow>
  )
}

function RoleBadge({ role }: { role: string }) {
  if (role === "owner") {
    return (
      <Badge className="border-transparent bg-violet-600 text-white hover:bg-violet-600/90">
        Owner
      </Badge>
    )
  }
  if (role === "admin") {
    return (
      <Badge className="border-transparent bg-primary text-primary-foreground hover:bg-primary/90">
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

/**
 * Never claims "Active" for someone who has not signed in. An em-dash is the
 * honest answer when we genuinely don't know.
 */
function StatusBadge({ user }: { user: ApiUser }) {
  if (user.lastSignInAt == null && user.invitedAt != null) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700">
        Invited
      </Badge>
    )
  }
  if (user.mustChangePassword) {
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-700">
        Password change pending
      </Badge>
    )
  }
  if (user.lastSignInAt != null) {
    return (
      <Badge variant="outline" className="border-emerald-300 text-emerald-700">
        Active
      </Badge>
    )
  }
  return <span className="text-sm text-muted-foreground">—</span>
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
            <Skeleton className="h-5 w-20 rounded-full" />
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <UsersIcon className="h-6 w-6 text-muted-foreground" />
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
/* Shared password + link controls                                     */
/* ------------------------------------------------------------------ */

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually")
    }
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={label}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

function PasswordField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Password</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          disabled={disabled}
          className="font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((prev) => !prev)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <CopyButton value={value} label="Copy password" />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange(generatePassword())
            setVisible(true)
          }}
          disabled={disabled}
        >
          <RefreshCw className="h-4 w-4" />
          Generate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters</p>
    </div>
  )
}

function RequireChangeCheckbox({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        disabled={disabled}
      />
      <Label htmlFor={id} className="text-sm font-normal">
        Require them to change it at first sign-in
      </Label>
    </div>
  )
}

/**
 * Shown when the account was created but the email never went out. The admin
 * gets the raw link to hand over — the alternative is a success toast for mail
 * that does not exist.
 */
function LinkFallbackDialog({
  state,
  onOpenChange,
}: {
  state: { title: string; url: string; error?: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!state} onOpenChange={(next) => (next ? undefined : onOpenChange(false))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
          <DialogDescription>
            Send this link to them yourself. It can only be used once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {state?.error ? (
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Input readOnly value={state?.url ?? ""} className="font-mono text-xs" />
            <CopyButton value={state?.url ?? ""} label="Copy link" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [mode, setMode] = useState<"invite" | "password">("invite")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("user")
  const [password, setPassword] = useState("")
  const [requireChange, setRequireChange] = useState(true)
  const [templateId, setTemplateId] = useState<PermissionTemplateId>("custom")
  const [submitting, setSubmitting] = useState(false)
  const [fallback, setFallback] = useState<{
    title: string
    url: string
    error?: string
  } | null>(null)

  function reset() {
    setMode("invite")
    setEmail("")
    setFullName("")
    setRole("user")
    setPassword("")
    setRequireChange(true)
    setTemplateId("custom")
  }

  async function handleSubmit() {
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    if (mode === "password") {
      // Checked here too so a length mistake doesn't cost a round trip.
      const passwordError = validatePassword(password)
      if (passwordError) {
        toast.error(passwordError)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          method: mode,
          templateId,
          ...(mode === "password"
            ? { password, requirePasswordChange: requireChange }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to create user")

      const createdEmail = email.trim()
      reset()
      onOpenChange(false)
      await onInvited()

      if (data.emailSent === false) {
        if (data.inviteUrl) {
          setFallback({
            title: "User created, but the email couldn't be sent",
            url: data.inviteUrl,
            error: data.emailError,
          })
        } else {
          toast.warning(
            `${createdEmail} was created, but the notification email didn't send.`,
            { description: data.emailError },
          )
        }
        return
      }

      toast.success(
        mode === "invite" ? `Invite sent to ${createdEmail}` : `Account created for ${createdEmail}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : (reset(), onOpenChange(false)))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a teammate</DialogTitle>
            <DialogDescription>
              {mode === "invite"
                ? "We'll email them a secure link to set their own password — no password to share."
                : "You set the password and share it with them directly."}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(value) => setMode(value as "invite" | "password")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite">Send invite email</TabsTrigger>
              <TabsTrigger value="password">Set a password</TabsTrigger>
            </TabsList>
          </Tabs>

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
            {mode === "password" ? (
              <>
                <PasswordField
                  id="invite-password"
                  value={password}
                  onChange={setPassword}
                  disabled={submitting}
                />
                <RequireChangeCheckbox
                  id="invite-require-change"
                  checked={requireChange}
                  onChange={setRequireChange}
                  disabled={submitting}
                />
              </>
            ) : null}
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
            <div className="space-y-2">
              <Label htmlFor="invite-template">Starting permissions</Label>
              <Select
                value={templateId}
                onValueChange={(value) => setTemplateId(value as PermissionTemplateId)}
              >
                <SelectTrigger id="invite-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISSION_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {mode === "invite" ? "Sending…" : "Creating…"}
                </>
              ) : mode === "invite" ? (
                <>
                  <Mail className="h-4 w-4" />
                  Send invite
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create user
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkFallbackDialog state={fallback} onOpenChange={() => setFallback(null)} />
    </>
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
  const [setPasswordOpen, setSetPasswordOpen] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [fallback, setFallback] = useState<{
    title: string
    url: string
    error?: string
  } | null>(null)

  const isSelf = !!user && user.id === currentUserId
  const isAdmin = user?.role === "admin" || user?.role === "owner"
  const isOwner = user?.role === "owner"
  const activeTemplate = user ? matchTemplate(user.permissions) : null

  async function handleRoleChange(role: string) {
    if (!user) return
    if (isSelf && role === "user") {
      toast.error("You can't demote your own account")
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
      const label = role === "admin" ? "Admin" : role === "owner" ? "Owner" : "User"
      toast.success(`Role updated to ${label}`)
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
    setSendingReset(true)
    try {
      const res = await fetch("/api/admin/send-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to send reset")

      if (data.emailSent === false && data.resetUrl) {
        setFallback({
          title: "Reset link created, but the email couldn't be sent",
          url: data.resetUrl,
          error: data.emailError,
        })
        return
      }
      toast.success(`Password reset sent to ${user.email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset")
    } finally {
      setSendingReset(false)
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
                  <AvatarFallback className="bg-muted font-semibold text-foreground">
                    {initialsOf(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{nameOf(user)}</SheetTitle>
                  <p className="truncate text-sm text-muted-foreground">{user.email ?? "—"}</p>
                </div>
                <div className="w-32 shrink-0">
                  {isSelf || isOwner ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Select value={user.role} disabled>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isOwner
                            ? "Owner role can only be changed in the database."
                            : "You can't change your own admin role"}
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
                        <SelectItem value="owner">Owner</SelectItem>
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
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 bg-background text-slate-600 hover:border-foreground/30 hover:bg-muted hover:text-foreground",
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
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Admins have unrestricted access
                    </p>
                    <p className="text-xs text-foreground">
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
                  disabled={!user.email || sendingReset}
                >
                  {sendingReset ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send password reset
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSetPasswordOpen(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  Set password
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

            <SetPasswordDialog
              open={setPasswordOpen}
              onOpenChange={setSetPasswordOpen}
              user={user}
              onSaved={(mustChangePassword) =>
                onPatchUser(user.id, { mustChangePassword })
              }
            />

            <LinkFallbackDialog state={fallback} onOpenChange={() => setFallback(null)} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Admin sets another user's password. The value lives only in local state for
 * the life of the dialog — it is never stored, echoed by the API, or shown again
 * after the dialog closes.
 */
function SetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: ApiUser
  onSaved: (mustChangePassword: boolean) => void
}) {
  const [password, setPassword] = useState("")
  const [requireChange, setRequireChange] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setPassword("")
    setRequireChange(true)
  }

  async function handleSubmit() {
    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          password,
          requirePasswordChange: requireChange,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to set password")
      toast.success(`Password updated for ${nameOf(user)}`)
      onSaved(requireChange)
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set password")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : (reset(), onOpenChange(false)))}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a password for {nameOf(user)}</DialogTitle>
          <DialogDescription>
            Share it with them directly. It won&apos;t be shown again after you close this.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <PasswordField
            id="set-password-value"
            value={password}
            onChange={setPassword}
            disabled={submitting}
          />
          <RequireChangeCheckbox
            id="set-password-require-change"
            checked={requireChange}
            onChange={setRequireChange}
            disabled={submitting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Set password
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
                className="data-[state=checked]:bg-primary"
                aria-label={entry.label}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
