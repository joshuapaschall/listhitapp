import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const apiKey = process.env.SHORTIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Short.io not configured" }, { status: 500 })
  }
  try {
    const res = await fetch(
      `https://api.short.io/api/domains/delete/${params.id}`,
      {
        method: "POST",
        headers: { Authorization: apiKey },
      },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Short.io error ${res.status}: ${text}`)
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Short.io delete domain failed", err)
    return NextResponse.json({ error: err.message || "error" }, { status: 500 })
  }
}
