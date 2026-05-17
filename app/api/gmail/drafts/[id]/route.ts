import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { getDraft } from "@/services/gmail-api"
import { decodeMessage } from "@/lib/gmail-utils"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const draft = await getDraft(user.id, params.id)
    const message = draft.message
    if (!message) return NextResponse.json({ draft: null })

    const headers = message.payload?.headers || []
    const headerOf = (name: string): string =>
      headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || ""
    const decoded = decodeMessage(message as any)
    return NextResponse.json({
      draft: {
        id: draft.id,
        messageId: message.id || null,
        threadId: message.threadId || null,
        to: headerOf("To"),
        cc: headerOf("Cc"),
        bcc: headerOf("Bcc"),
        subject: headerOf("Subject"),
        html: decoded.html || decoded.text || "",
      },
    })
  } catch (err: any) {
    console.error("Failed to get draft", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
