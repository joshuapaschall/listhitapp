"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Trash2, X } from "lucide-react"
import { supabase, type Buyer } from "@/lib/supabase"
import { toast } from "sonner"
import RecipientPicker, { type RecipientValue } from "@/components/messaging/recipient-picker"
import RichTextEditor from "@/components/gmail/rich-text-editor"

interface SendEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyer: Buyer | null
  onSuccess?: () => void
}

interface SenderOption {
  id: string
  fromEmail: string
  fromName: string | null
  replyTo: string | null
  isDefault: boolean
}

type EmailConsent = Pick<Buyer, "id" | "can_receive_email" | "email_suppressed" | "unsubscribed_at">

const LAST_SENDER_KEY = "listhit:lastSenderId"

const readLastSenderId = () => {
  try {
    return window.localStorage.getItem(LAST_SENDER_KEY)
  } catch {
    return null
  }
}

const writeLastSenderId = (id: string) => {
  try {
    window.localStorage.setItem(LAST_SENDER_KEY, id)
  } catch {
    // Storage unavailable (private mode, blocked site data) — remembering is a convenience.
  }
}

const senderLabel = (s: SenderOption) => (s.fromName ? `${s.fromName} <${s.fromEmail}>` : s.fromEmail)

const isEmailOptedOut = (b: EmailConsent | null | undefined) =>
  !!b && (b.can_receive_email === false || !!b.email_suppressed || !!b.unsubscribed_at)

const buyerName = (b: Buyer) => b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

// Treat an editor value that strips to nothing (e.g. "<p></p>" or whitespace) as empty.
const htmlIsEmpty = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0

export default function SendEmailModal({ open, onOpenChange, buyer, onSuccess }: SendEmailModalProps) {
  const [recipient, setRecipient] = useState<RecipientValue | null>(null)
  const [cc, setCc] = useState<RecipientValue | null>(null)
  const [bcc, setBcc] = useState<RecipientValue | null>(null)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [senderId, setSenderId] = useState("")

  const { data: senderData, isLoading: sendersLoading, isError: sendersError } = useQuery({
    queryKey: ["email-sender-options"],
    queryFn: async () => {
      const res = await fetch("/api/email/sender-options")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to load senders")
      return (data.senders || []) as SenderOption[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const senders = senderData ?? []

  // Pick the initial sender: last used (if still offered), else the default, else the first.
  useEffect(() => {
    if (!open || !senders.length) return
    if (senders.some((s) => s.id === senderId)) return
    const lastId = readLastSenderId()
    const initial = senders.find((s) => s.id === lastId) || senders.find((s) => s.isDefault) || senders[0]
    setSenderId(initial.id)
  }, [open, senders, senderId])

  // Prefill the recipient from the passed buyer (or clear it for the header case).
  useEffect(() => {
    if (!open) return
    if (buyer) setRecipient({ buyerId: buyer.id, value: buyer.email || "", label: buyerName(buyer) })
    else setRecipient(null)
  }, [open, buyer])

  const to = recipient?.value?.trim() || ""

  // Consent for whichever buyer the To field points at: the prefilled buyer is
  // already loaded; a buyer picked from search is looked up.
  const recipientBuyerId = recipient?.buyerId ?? null
  const needsConsentLookup = open && !!recipientBuyerId && recipientBuyerId !== buyer?.id
  const { data: pickedConsent } = useQuery({
    queryKey: ["buyer-email-consent", recipientBuyerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyers")
        .select("id,can_receive_email,email_suppressed,unsubscribed_at")
        .eq("id", recipientBuyerId as string)
        .maybeSingle()
      return (data as EmailConsent | null) ?? null
    },
    enabled: needsConsentLookup,
  })
  const recipientConsent: EmailConsent | null = !recipientBuyerId
    ? null
    : recipientBuyerId === buyer?.id
      ? buyer
      : pickedConsent ?? null
  const optedOut = isEmailOptedOut(recipientConsent)
  const optedOutDate = recipientConsent?.unsubscribed_at
    ? new Date(recipientConsent.unsubscribed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null

  const reset = () => {
    setRecipient(null)
    setCc(null)
    setBcc(null)
    setShowCc(false)
    setShowBcc(false)
    setSubject("")
    setBody("")
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const selectedSender = senders.find((s) => s.id === senderId) ?? null
  const canSend = !!selectedSender && !optedOut && !!to && !!subject.trim() && !htmlIsEmpty(body) && !sending

  const handleSubmit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch("/api/email/send-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: selectedSender!.id,
          to,
          cc: cc?.value ? [cc.value] : [],
          bcc: bcc?.value ? [bcc.value] : [],
          subject,
          html: body,
          buyerId: recipient?.buyerId ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to send email")
      }
      writeLastSenderId(selectedSender!.id)
      toast.success("Email sent")
      onSuccess?.()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="flex max-h-[88vh] max-w-xl flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden">
        {/* Header strip */}
        <div className="flex items-center justify-between bg-muted px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">New email</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          {/* From */}
          <div className="flex items-center gap-2 border-b border-border py-2.5 text-sm">
            <span className="w-14 shrink-0 text-muted-foreground">From</span>
            {sendersLoading ? (
              <span className="truncate text-muted-foreground">Loading senders…</span>
            ) : sendersError ? (
              <span className="truncate text-destructive">Couldn&apos;t load your senders. Close and try again.</span>
            ) : senders.length === 0 ? (
              <span className="truncate text-muted-foreground">
                No verified sender yet.{" "}
                <Link href="/settings/email-domains" className="text-primary underline-offset-2 hover:underline">
                  Add and verify a sending domain
                </Link>
              </span>
            ) : senders.length === 1 ? (
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span className="truncate">{senderLabel(senders[0])}</span>
                {senders[0].isDefault ? <Badge variant="secondary">Default</Badge> : null}
              </span>
            ) : (
              <Select value={senderId} onValueChange={setSenderId}>
                <SelectTrigger
                  aria-label="From"
                  className="h-8 min-w-0 flex-1 border-0 px-0 shadow-none focus:ring-0 focus:ring-offset-0"
                >
                  <SelectValue placeholder="Choose a sender" />
                </SelectTrigger>
                <SelectContent>
                  {senders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{senderLabel(s)}</span>
                        {s.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* To */}
          <div className="flex items-start gap-2 border-b border-border py-2.5">
            <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">To</span>
            <div className="min-w-0 flex-1">
              <RecipientPicker mode="email" value={recipient} onChange={setRecipient} />
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-2 text-xs text-muted-foreground">
              {!showCc ? (
                <button type="button" onClick={() => setShowCc(true)} className="hover:text-foreground">
                  Cc
                </button>
              ) : null}
              {!showBcc ? (
                <button type="button" onClick={() => setShowBcc(true)} className="hover:text-foreground">
                  Bcc
                </button>
              ) : null}
            </div>
          </div>

          {/* Cc */}
          {showCc ? (
            <div className="flex items-start gap-2 border-b border-border py-2.5">
              <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">Cc</span>
              <div className="min-w-0 flex-1">
                <RecipientPicker mode="email" value={cc} onChange={setCc} placeholder="Cc" />
              </div>
            </div>
          ) : null}

          {/* Bcc */}
          {showBcc ? (
            <div className="flex items-start gap-2 border-b border-border py-2.5">
              <span className="w-14 shrink-0 pt-2 text-sm text-muted-foreground">Bcc</span>
              <div className="min-w-0 flex-1">
                <RecipientPicker mode="email" value={bcc} onChange={setBcc} placeholder="Bcc" />
              </div>
            </div>
          ) : null}

          {optedOut ? (
            <div
              role="alert"
              className="mt-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {optedOutDate
                ? `This buyer unsubscribed from email on ${optedOutDate}. You can't email them.`
                : "This buyer has opted out of email. You can't email them."}
            </div>
          ) : null}

          {/* Subject */}
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            aria-label="Subject"
            className="h-10 shrink-0 rounded-none border-0 border-b border-border px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-hidden py-1">
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message…"
              minHeight={200}
              className="h-full"
              toolbarClassName="border-border"
            />
          </div>
        </div>

        <p className="shrink-0 px-4 pb-2 text-xs text-muted-foreground">
          Your business address and an unsubscribe link are added automatically.
        </p>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
          <Button variant="brand" onClick={handleSubmit} disabled={!canSend} className="gap-1.5">
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send"}
          </Button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Discard draft"
            title="Discard"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
