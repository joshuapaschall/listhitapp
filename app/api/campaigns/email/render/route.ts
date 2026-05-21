import { NextRequest, NextResponse } from "next/server"
import mjml2html from "mjml"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
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
