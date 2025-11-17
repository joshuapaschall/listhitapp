import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"

type Row = {
  id: string
  email: string | null
  can_receive_email: boolean | null
  sendfox_hidden: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const groupIds: string[] = Array.isArray(body?.groupIds) ? body.groupIds : []
    if (!groupIds.length) {
      return new Response(JSON.stringify({ count: 0, sample: [], reason: "no groups" }), { status: 200 })
    }

    const { data: buyers, error } = await supabase
      .from("buyers")
      .select("id,email,can_receive_email,sendfox_hidden,buyer_groups!inner(group_id)")
      .in("buyer_groups.group_id", groupIds as any)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

    const recipients = (buyers as any as Row[])
      .filter(b => !b.sendfox_hidden)
      .filter(b => !!b.email)
      .filter(b => (b.can_receive_email !== false)) // switch to === true if you want strict consent

    const unique: Row[] = []
    const seen = new Set<string>()
    for (const r of recipients) {
      const key = (r.email || "").toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push(r)
    }

    const sample = unique.slice(0, 10).map(r => r.email)

    return new Response(JSON.stringify({ count: unique.length, sample }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
