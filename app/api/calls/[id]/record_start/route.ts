import { NextResponse } from "next/server"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id
  const r = await fetch(`${TELNYX_API_URL}/calls/${id}/actions/record_start`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({ channels: "dual" }),
  })
  const d = await r.json().catch(() => ({}))
  return NextResponse.json(d, { status: r.status })
}
