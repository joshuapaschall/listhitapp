import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const path = body?.path
  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path required" }, { status: 400 })
  }

  const apiKey = process.env.SHORTIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Short.io not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.short.io/links/${params.id}`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Short.io error ${res.status}: ${text}`)
    }

    const data = await res.json()
    return NextResponse.json({ path: data.path })
  } catch (err: any) {
    console.error("Short.io update failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const apiKey = process.env.SHORTIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Short.io not configured" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.short.io/links/${params.id}`, {
      method: "DELETE",
      headers: {
        Authorization: apiKey,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Short.io error ${res.status}: ${text}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Short.io delete failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}
