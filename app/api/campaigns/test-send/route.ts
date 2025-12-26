import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { sendSesEmail } from "@/lib/ses"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const to = typeof body?.to === "string" ? body.to.trim() : ""
    const subject = typeof body?.subject === "string" ? body.subject.trim() : ""
    const html = typeof body?.html === "string" ? body.html : ""

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error("Auth error on test email send", authError)
    }

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 })
    }

    if (!to || !subject || !html.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "to, subject, and html are required" }),
        { status: 400 },
      )
    }

    await sendSesEmail({
      to,
      subject,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err: any) {
    console.error("Failed to send test email", err)
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "Failed to send test email" }),
      { status: 500 },
    )
  }
}
