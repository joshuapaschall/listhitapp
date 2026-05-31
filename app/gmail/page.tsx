"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail } from "lucide-react"
import { toast } from "sonner"
import MainLayout from "@/components/layout/main-layout"
import { usePermissions } from "@/hooks/use-permissions"
import { Button } from "@/components/ui/button"
import { ListPane, ConversationPane, ComposeWindow, Sidebar, TopBar } from "@/components/gmail"

interface SimpleThread { id: string; draftId?: string | null }
interface GmailAccount { id: string; email: string; is_active: boolean }
interface LabelDetail { id: string; name: string; threadsTotal?: number; threadsUnread?: number; messagesTotal?: number; messagesUnread?: number }
interface LabelsResponse { email: string | null; system: LabelDetail[]; categories: LabelDetail[]; user: LabelDetail[] }
interface ThreadsResponse { threads: SimpleThread[]; nextPageToken: string | null; resultSizeEstimate: number }

const CONNECT_ERRORS: Record<string, string> = {
  missing_params: "Missing OAuth callback parameters.",
  state_mismatch: "Security check failed. Please try connecting Gmail again.",
  env_missing: "Gmail OAuth is not configured correctly.",
  token_exchange_failed: "Could not exchange authorization code for tokens.",
  userinfo_failed: "Could not fetch Gmail profile information.",
  no_email: "Connected Google account did not provide an email.",
  no_refresh_token: "Google did not return a refresh token. Please try again.",
}

export default function GmailPage() {
  const PAGE_SIZE = 50
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [folder, setFolder] = useState("inbox")
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [showCompose, setShowCompose] = useState(false)
  const [composeInitial, setComposeInitial] = useState<{ draftId: string; to: string; cc: string; bcc: string; subject: string; body: string } | null>(null)
  const [pageTokenStack, setPageTokenStack] = useState<(string | undefined)[]>([undefined])
  const [pageIndex, setPageIndex] = useState(0)
  const [keyboardIndex, setKeyboardIndex] = useState<number>(-1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { can, loading: permissionsLoading } = usePermissions()
  const canAccessGmail = can("gmail.access")

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<GmailAccount[]>({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/gmail/accounts")
      if (!res.ok) return []
      return res.json()
    },
    enabled: !permissionsLoading && canAccessGmail,
  })

  const hasActiveAccount = accounts.some((account) => account.is_active)

  const { data: labelData } = useQuery<LabelsResponse>({
    queryKey: ["gmail-labels"],
    queryFn: async () => {
      const res = await fetch("/api/gmail/labels")
      if (!res.ok) throw new Error("Failed labels")
      return res.json()
    },
    enabled: !permissionsLoading && canAccessGmail && hasActiveAccount,
    staleTime: 30 * 1000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const connected = searchParams.get("connected")
    const connectError = searchParams.get("connect_error")
    if (!connected && !connectError) return
    if (connected === "1") toast.success("Gmail connected!")
    if (connectError) toast.error(CONNECT_ERRORS[connectError] || "Gmail connection failed. Please try again.")
    router.replace("/gmail")
  }, [router, searchParams])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPageTokenStack([undefined])
    setPageIndex(0)
  }, [folder, selectedLabelId])

  useEffect(() => {
    setPageTokenStack([undefined])
    setPageIndex(0)
  }, [debouncedSearch])

  const currentPageToken = pageTokenStack[pageIndex]
  const { data, isLoading, error } = useQuery<ThreadsResponse>({
    queryKey: ["gmail-threads", folder, selectedLabelId, currentPageToken, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ maxResults: String(PAGE_SIZE) })
      if (selectedLabelId) params.set("labelId", selectedLabelId)
      else params.set("folder", folder)
      if (currentPageToken) params.set("pageToken", currentPageToken)
      if (debouncedSearch) params.set("q", debouncedSearch)
      const res = await fetch(`/api/gmail/threads?${params.toString()}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load threads")
      return json as ThreadsResponse
    },
    placeholderData: keepPreviousData,
    enabled: !permissionsLoading && canAccessGmail && hasActiveAccount,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const threads = data?.threads || []
  const nextPageToken = data?.nextPageToken || null

  const folderToLabelId: Record<string, string> = { inbox: "INBOX", starred: "STARRED", sent: "SENT", drafts: "DRAFT", trash: "TRASH", spam: "SPAM", important: "IMPORTANT", allMail: "ALL_MAIL" }
  const currentLabelId = selectedLabelId || folderToLabelId[folder] || ""
  const allLabels = [...(labelData?.system || []), ...(labelData?.categories || []), ...(labelData?.user || [])]
  const matchedLabel = allLabels.find((l) => l.id === currentLabelId)
  const folderTotal = matchedLabel?.threadsTotal ?? matchedLabel?.messagesTotal ?? 0
  const pageStart = folderTotal === 0 ? 0 : pageIndex * PAGE_SIZE + 1
  const pageEnd = Math.min((pageIndex + 1) * PAGE_SIZE, folderTotal || (pageIndex * PAGE_SIZE + threads.length))
  const canPrev = pageIndex > 0
  const canNext = Boolean(nextPageToken)
  const isSearching = debouncedSearch.length > 0
  const displayTotal = isSearching ? (data?.resultSizeEstimate ?? threads.length) : folderTotal

  useEffect(() => { setKeyboardIndex(-1) }, [folder, selectedLabelId, debouncedSearch, pageIndex])

  function handlePrev() {
    if (!canPrev) return
    setPageIndex((i) => Math.max(0, i - 1))
    setSelectedThread(null)
  }

  function handleNext() {
    if (!canNext || !nextPageToken) return
    setPageTokenStack((stack) => {
      if (stack[pageIndex + 1]) return stack
      const copy = stack.slice(0, pageIndex + 1)
      copy.push(nextPageToken)
      return copy
    })
    setPageIndex((i) => i + 1)
    setSelectedThread(null)
  }

  async function handleThreadClick(threadId: string) {
    if (folder === "drafts") {
      const thread = threads.find((t) => t.id === threadId)
      const draftId = thread?.draftId
      if (draftId) {
        try {
          const res = await fetch(`/api/gmail/drafts/${draftId}`)
          const json = await res.json()
          if (json.draft) {
            setComposeInitial({ draftId, to: json.draft.to || "", cc: json.draft.cc || "", bcc: json.draft.bcc || "", subject: json.draft.subject || "", body: json.draft.html || "" })
            setShowCompose(true)
            return
          }
        } catch (e) {
          console.error("Failed to load draft", e)
        }
      }
    }
    setSelectedThread(threadId)
  }


  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (el.isContentEditable) return true
      if (el.closest("[contenteditable=true]")) return true
      if (el.closest(".ProseMirror")) return true
      return false
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { if (showCompose) { setShowCompose(false); setComposeInitial(null); e.preventDefault(); return } if (selectedThread) { setSelectedThread(null); e.preventDefault(); return } }
      if (e.key === "/" && !isTypingTarget(e.target)) { const el = document.getElementById("mail-search") as HTMLInputElement | null; if (el) { el.focus(); e.preventDefault() } return }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case "c": setComposeInitial(null); setShowCompose(true); e.preventDefault(); break
        case "j": if (selectedThread) { const idx = threads.findIndex((t) => t.id === selectedThread); if (idx >= 0 && idx < threads.length - 1) setSelectedThread(threads[idx + 1].id) } else { setKeyboardIndex((i) => Math.min(threads.length - 1, (i < 0 ? 0 : i + 1))) } e.preventDefault(); break
        case "k": if (selectedThread) { const idx = threads.findIndex((t) => t.id === selectedThread); if (idx > 0) setSelectedThread(threads[idx - 1].id) } else { setKeyboardIndex((i) => Math.max(0, i - 1)) } e.preventDefault(); break
        case "enter": if (!selectedThread && keyboardIndex >= 0 && keyboardIndex < threads.length) { const t = threads[keyboardIndex]; if (t) handleThreadClick(t.id); e.preventDefault() } break
        case "e": { const archiveTarget = selectedThread || (keyboardIndex >= 0 ? threads[keyboardIndex]?.id : null); if (archiveTarget) { fetch("/api/gmail/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: archiveTarget }) }).then(() => { queryClient.invalidateQueries({ queryKey: ["gmail-threads"] }); queryClient.invalidateQueries({ queryKey: ["gmail-labels"] }); if (selectedThread === archiveTarget) setSelectedThread(null) }); e.preventDefault() } break }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [threads, selectedThread, showCompose, keyboardIndex, queryClient])

  if (permissionsLoading) return <MainLayout><div className="flex h-full items-center justify-center p-8"><div className="text-sm text-muted-foreground">Checking Gmail permissions...</div></div></MainLayout>

  if (!canAccessGmail) {
    return <MainLayout><div className="space-y-2 p-6"><h1 className="text-2xl font-semibold tracking-tight">Gmail</h1><p className="text-sm text-muted-foreground">You do not have permission to access Gmail.</p></div></MainLayout>
  }

  if (accountsLoading) return <MainLayout><div className="flex h-full items-center justify-center p-8"><div className="text-sm text-muted-foreground">Loading...</div></div></MainLayout>

  if (!hasActiveAccount) {
    return <MainLayout><div className="flex h-full items-center justify-center p-8"><div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-10 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Mail className="h-8 w-8 text-primary" /></div><div className="space-y-2"><h2 className="text-2xl font-semibold tracking-tight">Connect your Gmail</h2><p className="text-sm text-muted-foreground">Connect a Gmail account to see your inbox, send replies, and link emails to buyers.</p></div><Button asChild size="lg" className="w-full"><a href="/api/gmail/auth/init">Connect Gmail</a></Button>{accounts.length > 0 && <p className="text-xs text-muted-foreground">{accounts.length} disconnected account{accounts.length === 1 ? "" : "s"} - reconnect to use it.</p>}</div></div></MainLayout>
  }

  return (
    <MainLayout>
      <div className="flex h-full flex-col"><div className="flex min-h-0 flex-1"><Sidebar folder={folder} selectedLabelId={selectedLabelId} onChange={(f, lid) => { setFolder(f); setSelectedLabelId(lid); setSelectedThread(null) }} onCompose={() => { setComposeInitial(null); setShowCompose(true) }} accounts={accounts} /><div className="flex min-w-0 flex-1 flex-col"><TopBar search={search} onSearchChange={setSearch} isSearching={isSearching} totalCount={displayTotal} pageStart={pageStart} pageEnd={pageEnd} canPrev={canPrev} canNext={canNext} onPrev={handlePrev} onNext={handleNext} />{!selectedThread ? <ListPane threads={threads} isLoading={Boolean(isLoading)} error={error} search={search} onSelect={handleThreadClick} selectedId={selectedThread || undefined} keyboardIndex={keyboardIndex} /> : <ConversationPane threadId={selectedThread} onBack={() => setSelectedThread(null)} onPrev={() => { const idx = threads.findIndex((t) => t.id === selectedThread); if (idx > 0) setSelectedThread(threads[idx - 1].id) }} onNext={() => { const idx = threads.findIndex((t) => t.id === selectedThread); if (idx >= 0 && idx < threads.length - 1) setSelectedThread(threads[idx + 1].id) }} />}</div></div></div>
      <ComposeWindow open={showCompose} onClose={() => { setShowCompose(false); setComposeInitial(null) }} accounts={accounts} initial={composeInitial || undefined} onSent={() => { queryClient.invalidateQueries({ queryKey: ["gmail-threads"] }); queryClient.invalidateQueries({ queryKey: ["gmail-labels"] }) }} />
    </MainLayout>
  )
}
