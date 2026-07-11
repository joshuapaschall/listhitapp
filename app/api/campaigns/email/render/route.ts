import { NextRequest, NextResponse } from "next/server"
import mjml2html from "mjml"
import { requireOrgContext } from "@/lib/auth/org-context"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { user, orgId } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const body = (await request.json()) as { mjml?: string }
    if (!body.mjml || typeof body.mjml !== "string") {
      return NextResponse.json({ error: "mjml is required" }, { status: 400 })
    }
    const result = await mjml2html(body.mjml, { validationLevel: "soft" })
    return NextResponse.json({ html: result.html, errors: result.errors ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "MJML compile failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
