"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Inbox,
  Star,
  AlertCircle,
  Send,
  FileText,
  Trash2,
  AlertOctagon,
  Pencil,
  ChevronDown,
  Tag,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import AccountSwitcher from "./account-switcher"

interface Account {
  id: string
  email: string
  is_active: boolean
}
interface SidebarProps {
  folder: string
  selectedLabelId: string | null
  onChange: (folder: string, labelId: string | null) => void
  onCompose: () => void
  accounts: Account[]
}
interface LabelDetail {
  id: string
  name: string
  type: "system" | "user"
  messagesUnread?: number
  threadsUnread?: number
  color?: { backgroundColor?: string; textColor?: string }
}
interface LabelsResponse {
  email: string | null
  system: LabelDetail[]
  categories: LabelDetail[]
  user: LabelDetail[]
}
const SYSTEM_LABEL_META: Record<string, { key: string; icon: typeof Inbox; label: string }> = {
  INBOX: { key: "inbox", icon: Inbox, label: "Inbox" },
  STARRED: { key: "starred", icon: Star, label: "Starred" },
  IMPORTANT: { key: "important", icon: AlertCircle, label: "Important" },
  SENT: { key: "sent", icon: Send, label: "Sent" },
  DRAFT: { key: "drafts", icon: FileText, label: "Drafts" },
  SPAM: { key: "spam", icon: AlertOctagon, label: "Spam" },
  TRASH: { key: "trash", icon: Trash2, label: "Trash" },
}
const CATEGORY_META: Record<string, { name: string; color: string }> = {
  CATEGORY_PERSONAL: { name: "Personal", color: "bg-violet-500" },
  CATEGORY_SOCIAL: { name: "Social", color: "bg-blue-500" },
  CATEGORY_PROMOTIONS: { name: "Promotions", color: "bg-green-500" },
  CATEGORY_UPDATES: { name: "Updates", color: "bg-amber-500" },
  CATEGORY_FORUMS: { name: "Forums", color: "bg-cyan-500" },
}
function unreadOf(label: LabelDetail): number {
  return label.threadsUnread ?? label.messagesUnread ?? 0
}

export default function Sidebar({ folder, selectedLabelId, onChange, onCompose, accounts }: SidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true)
  const [labelsOpen, setLabelsOpen] = useState(true)

  const { data: labelData } = useQuery<LabelsResponse>({
    queryKey: ["gmail-labels"],
    queryFn: async () => {
      const res = await fetch("/api/gmail/labels")
      if (!res.ok) throw new Error("Failed to load labels")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  return (
    <div className="hidden w-64 shrink-0 gap-2 overflow-y-auto border-r p-3 sm:flex sm:flex-col">
      <AccountSwitcher accounts={accounts} />
      <button
        onClick={onCompose}
        className="mt-1 flex w-fit items-center gap-3 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md"
      >
        <Pencil className="h-4 w-4" />
        Compose
      </button>
      <div className="mt-2 space-y-0.5">
        {labelData?.system
          .filter((l) => SYSTEM_LABEL_META[l.id])
          .map((label) => {
            const meta = SYSTEM_LABEL_META[label.id]
            const Icon = meta.icon
            const isActive = !selectedLabelId && folder === meta.key
            const unread = unreadOf(label)
            return (
              <button
                key={label.id}
                onClick={() => onChange(meta.key, null)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="flex-1 truncate text-left">{meta.label}</span>
                {unread > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
      </div>

      {labelData && labelData.categories.length > 0 && (
        <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen} className="mt-2">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-3 w-3 transition-transform", !categoriesOpen && "-rotate-90")} />
            Categories
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">
            {labelData.categories.map((label) => {
              const meta = CATEGORY_META[label.id]
              if (!meta) return null
              const isActive = selectedLabelId === label.id
              const unread = unreadOf(label)
              return (
                <button
                  key={label.id}
                  onClick={() => onChange("label", label.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.color)} />
                  <span className="flex-1 truncate text-left">{meta.name}</span>
                  {unread > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </CollapsibleContent>
        </Collapsible>
      )}

      {labelData && labelData.user.length > 0 && (
        <Collapsible open={labelsOpen} onOpenChange={setLabelsOpen} className="mt-2">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-3 w-3 transition-transform", !labelsOpen && "-rotate-90")} />
            Labels
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">
            {labelData.user.map((label) => {
              const isActive = selectedLabelId === label.id
              const unread = unreadOf(label)
              const tagColor = label.color?.backgroundColor || "#6b7280"
              return (
                <button
                  key={label.id}
                  onClick={() => onChange("label", label.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: tagColor }} />
                  <span className="flex-1 truncate text-left">{label.name}</span>
                  {unread > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
