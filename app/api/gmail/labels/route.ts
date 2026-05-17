import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { getActiveAccount } from "@/services/gmail-tokens"
import { assertServer } from "@/utils/assert-server"

assertServer()

const SYSTEM_LABEL_IDS = new Set(["INBOX", "STARRED", "IMPORTANT", "SENT", "DRAFT", "TRASH", "SPAM"])
const CATEGORY_LABEL_IDS = new Set([
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
])

interface GmailLabelBasic {
  id: string
  name: string
  type?: "system" | "user"
  messageListVisibility?: "show" | "hide"
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide"
  color?: { backgroundColor?: string; textColor?: string }
}

interface GmailLabelDetail extends GmailLabelBasic {
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
}

export interface LabelsResponse {
  email: string | null
  system: GmailLabelDetail[]
  categories: GmailLabelDetail[]
  user: GmailLabelDetail[]
}

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { accessToken, email } = await getActiveAccount(user.id)
    const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!listRes.ok) {
      const body = await listRes.text()
      console.error("Gmail labels.list failed:", listRes.status, body)
      return NextResponse.json({ error: "Failed to list labels" }, { status: 500 })
    }

    const listJson = await listRes.json()
    const allLabels: GmailLabelBasic[] = listJson.labels || []
    const visible = allLabels.filter((label) => {
      if (label.labelListVisibility === "labelHide") return false
      if (SYSTEM_LABEL_IDS.has(label.id)) return true
      if (CATEGORY_LABEL_IDS.has(label.id)) return true
      if (label.type === "user") return true
      return false
    })

    const detailed: GmailLabelDetail[] = await Promise.all(
      visible.map(async (label) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(label.id)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          )
          if (!detailRes.ok) return label as GmailLabelDetail
          const detail = await detailRes.json()
          return {
            ...label,
            messagesTotal: detail.messagesTotal,
            messagesUnread: detail.messagesUnread,
            threadsTotal: detail.threadsTotal,
            threadsUnread: detail.threadsUnread,
          }
        } catch {
          return label as GmailLabelDetail
        }
      }),
    )

    const system: GmailLabelDetail[] = []
    const categories: GmailLabelDetail[] = []
    const userLabels: GmailLabelDetail[] = []

    for (const label of detailed) {
      if (CATEGORY_LABEL_IDS.has(label.id)) categories.push(label)
      else if (SYSTEM_LABEL_IDS.has(label.id)) system.push(label)
      else if (label.type === "user") userLabels.push(label)
    }

    userLabels.sort((a, b) => a.name.localeCompare(b.name))
    const systemOrder = ["INBOX", "STARRED", "IMPORTANT", "SENT", "DRAFT", "TRASH", "SPAM"]
    system.sort((a, b) => systemOrder.indexOf(a.id) - systemOrder.indexOf(b.id))

    return NextResponse.json({ email, system, categories, user: userLabels } as LabelsResponse)
  } catch (err: any) {
    if (err.message === "Gmail token not found") {
      return NextResponse.json({ error: "No active Gmail account" }, { status: 404 })
    }
    console.error("Failed to fetch labels:", err)
    return NextResponse.json({ error: "Failed to fetch labels" }, { status: 500 })
  }
}
