"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import { ListPane, ConversationPane, ComposeModal, Sidebar, TopBar } from "@/components/gmail"

interface SimpleThread { id: string }

export default function GmailPage() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [folder, setFolder] = useState("inbox")
  const [search, setSearch] = useState("")
  const [showCompose, setShowCompose] = useState(false)
  const queryClient = useQueryClient()
  const { data: threads = [], isLoading, error } = useQuery<SimpleThread[]>({
    queryKey: ["gmail-threads", folder],
    queryFn: async () => {
      const res = await fetch(`/api/gmail/threads?maxResults=100&folder=${folder}`)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load threads")
      }
      return json.threads as SimpleThread[]
    },
    keepPreviousData: true,
  })

  return (
    <MainLayout>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1">
          <Sidebar folder={folder} onChange={setFolder} onCompose={() => setShowCompose(true)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar search={search} onSearchChange={setSearch} />
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
