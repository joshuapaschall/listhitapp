import { NextRequest, NextResponse } from "next/server"
import { createShortLink } from "@/services/shortio-service"

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const originalURL = body?.originalURL
  const path = body?.path

  if (!originalURL || typeof originalURL !== "string") {
    return NextResponse.json({ error: "originalURL required" }, { status: 400 })
  }

  try {
    const { shortURL, path: slug, idString } = await createShortLink(originalURL, path)
    return NextResponse.json({ shortURL, path: slug, idString })
  } catch (err: any) {
    console.error("Short.io failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}
