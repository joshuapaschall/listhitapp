import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.SHORTIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Short.io not configured" }, { status: 500 })
  }
  try {
    const res = await fetch("https://api.short.io/api/domains", {
      headers: { Authorization: apiKey },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Short.io error ${res.status}: ${text}`)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Short.io domains failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.SHORTIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Short.io not configured" }, { status: 500 })
  }
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const hostname = body?.hostname
  if (!hostname || typeof hostname !== "string") {
    return NextResponse.json({ error: "hostname required" }, { status: 400 })
  }
  try {
    const res = await fetch("https://api.short.io/api/domains", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hostname, linkType: "random" }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Short.io error ${res.status}: ${text}`)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Short.io create domain failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}
