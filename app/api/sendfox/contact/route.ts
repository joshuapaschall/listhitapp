import { NextRequest } from "next/server"
import { getSendfoxToken } from "@/lib/sendfox-env"

export async function POST(req: NextRequest) {
  try {
    const token = getSendfoxToken()
    if (!token) {
      return new Response(JSON.stringify({ error: "missing SENDFOX_API_TOKEN" }), { status: 401 })
    }

    const body = await req.json()
    const email = (body?.email || "").trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400 })
    }

    let lists = Array.isArray(body?.lists) ? body.lists : []
    if ((!lists || lists.length === 0) && process.env.SENDFOX_DEFAULT_LIST_ID) {
      lists = [Number(process.env.SENDFOX_DEFAULT_LIST_ID)]
    }
    if (!Array.isArray(lists) || lists.some((n: any) => !Number.isInteger(Number(n)))) {
      return new Response(JSON.stringify({ error: "lists must be array of integers" }), { status: 400 })
    }

    const baseUrl = "https://api.sendfox.com"

    // 1) Look up existing by email
    const lookupResp = await fetch(`${baseUrl}/contacts?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    })

    let contactId: number | null = null
    if (lookupResp.ok) {
      const lookupData = await lookupResp.json().catch(() => null)
      if (Array.isArray(lookupData?.data) && lookupData.data.length > 0) {
        contactId = Number(lookupData.data[0]?.id) || null
      }
    }

    // 2) Build payload – SendFox overwrites lists when posting same email
    const payload: any = {
      email,
      first_name: body?.first_name,
      last_name: body?.last_name,
      lists: lists.map((n: any) => Number(n)),
    }

    // 3) POST create-or-overwrite
    const resp = await fetch(`${baseUrl}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      return new Response(JSON.stringify(data || { error: "sendfox error" }), { status: resp.status })
    }

    return new Response(JSON.stringify({ id: data?.id ?? contactId }), { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 })
  }
}
