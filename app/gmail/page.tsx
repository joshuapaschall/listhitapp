"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { Mail } from "lucide-react"
import { toast } from "sonner"
import MainLayout from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { ListPane, ConversationPane, ComposeModal, Sidebar, TopBar } from "@/components/gmail"

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

    if (connected === "1") {
      toast.success("Gmail connected!")
    }

    if (connectError) {
      toast.error(CONNECT_ERRORS[connectError] || "Gmail connection failed. Please try again.")
    }

    router.replace("/gmail")
  }, [router, searchParams])

  const { data: threads = [], isLoading, error } = useQuery<SimpleThread[]>({
    queryKey: ["gmail-threads", folder, selectedLabelId],
    queryFn: async () => {
      const params = new URLSearchParams({ maxResults: "100" })
      if (selectedLabelId) {
        params.set("labelId", selectedLabelId)
      } else {
        params.set("folder", folder)
      }
      const res = await fetch(`/api/gmail/threads?${params.toString()}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load threads")
      }
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
              <a href="/api/gmail/auth/init">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connect Gmail
              </a>
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
      <ComposeModal
        open={showCompose}
        onOpenChange={setShowCompose}
        onSent={() => queryClient.invalidateQueries({ queryKey: ["gmail-threads"] })}
      />
    </MainLayout>
  )
}
