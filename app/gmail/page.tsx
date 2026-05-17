"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail } from "lucide-react"
import { toast } from "sonner"
import MainLayout from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { ListPane, ConversationPane, ComposeWindow, Sidebar, TopBar } from "@/components/gmail"

interface SimpleThread { id: string }
interface GmailAccount { id: string; email: string; is_active: boolean }

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
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [folder, setFolder] = useState("inbox")
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showCompose, setShowCompose] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<GmailAccount[]>({
    queryKey: ["gmail-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/gmail/accounts")
      if (!res.ok) return []
      return res.json()
    },
  })

  const hasActiveAccount = accounts.some((account) => account.is_active)

  useEffect(() => {
    const connected = searchParams.get("connected")
    const connectError = searchParams.get("connect_error")
    if (!connected && !connectError) return
    if (connected === "1") toast.success("Gmail connected!")
    if (connectError) toast.error(CONNECT_ERRORS[connectError] || "Gmail connection failed. Please try again.")
    router.replace("/gmail")
  }, [router, searchParams])

  const { data: threads = [], isLoading, error } = useQuery<SimpleThread[]>({
    queryKey: ["gmail-threads", folder, selectedLabelId],
    queryFn: async () => {
      const params = new URLSearchParams({ maxResults: "100" })
      if (selectedLabelId) params.set("labelId", selectedLabelId)
      else params.set("folder", folder)
      const res = await fetch(`/api/gmail/threads?${params.toString()}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load threads")
      return json.threads as SimpleThread[]
    },
    placeholderData: keepPreviousData,
    enabled: hasActiveAccount,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  if (accountsLoading) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </MainLayout>
    )
  }

  if (!hasActiveAccount) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Connect your Gmail</h2>
              <p className="text-sm text-muted-foreground">
                Connect a Gmail account to see your inbox, send replies, and link emails to buyers.
              </p>
            </div>
            <Button asChild size="lg" className="w-full">
              <a href="/api/gmail/auth/init">Connect Gmail</a>
            </Button>
            {accounts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {accounts.length} disconnected account{accounts.length === 1 ? "" : "s"} - reconnect to use it.
              </p>
            )}
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1">
          <Sidebar
            folder={folder}
            selectedLabelId={selectedLabelId}
            onChange={(f, lid) => {
              setFolder(f)
              setSelectedLabelId(lid)
              setSelectedThread(null)
            }}
            onCompose={() => setShowCompose(true)}
            accounts={accounts}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              search={search}
              onSearchChange={setSearch}
              totalCount={threads.length}
              pageStart={threads.length > 0 ? 1 : 0}
              pageEnd={threads.length}
            />
            {!selectedThread ? (
              <ListPane
                threads={threads}
                isLoading={Boolean(isLoading)}
                error={error}
                search={search}
                onSelect={setSelectedThread}
                selectedId={selectedThread || undefined}
              />
            ) : (
              <ConversationPane
                threadId={selectedThread}
                onBack={() => setSelectedThread(null)}
                onPrev={() => {
                  const idx = threads.findIndex((t) => t.id === selectedThread)
                  if (idx > 0) setSelectedThread(threads[idx - 1].id)
                }}
                onNext={() => {
                  const idx = threads.findIndex((t) => t.id === selectedThread)
                  if (idx >= 0 && idx < threads.length - 1) setSelectedThread(threads[idx + 1].id)
                }}
              />
            )}
          </div>
        </div>
      </div>
      <ComposeWindow
        open={showCompose}
        onClose={() => setShowCompose(false)}
        accounts={accounts}
        onSent={() => queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })}
      />
    </MainLayout>
  )
}
