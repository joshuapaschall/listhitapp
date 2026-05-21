import { NextRequest, NextResponse } from "next/server"
import mjml2html from "mjml"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { mjml?: string }

  if (!body.mjml) {
    return NextResponse.json({ error: "mjml is required" }, { status: 400 })
  }

  const result = await mjml2html(body.mjml)
  return NextResponse.json({ html: result.html })
}
