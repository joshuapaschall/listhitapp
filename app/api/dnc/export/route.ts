import { NextResponse } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"
import { requirePermission } from "@/lib/permissions/server"
import { listDnc, deriveDncSource } from "@/lib/dnc/service"
import type { Buyer } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Mirror the CSV escaping style from lib/export-utils.ts.
function escapeCsv(field: unknown): string {
  const s = String(field ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const smsOk = (b: Buyer) => b.can_receive_sms !== false && !b.sms_suppressed
const emailOk = (b: Buyer) => b.can_receive_email !== false && !b.email_suppressed && !b.is_unsubscribed
const callsOk = (b: Buyer) => b.can_receive_calls !== false

const addedAt = (b: Buyer) =>
  b.unsubscribed_at || b.sms_suppressed_at || b.email_suppressed_at || b.blocked_at || ""

export async function GET() {
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const denied = await requirePermission(supabase, "buyers.view")
    if (denied) return denied

    const pageSize = 200
    const first = await listDnc(orgId, { page: 1, pageSize })
    const rows = [...first.rows]
    const totalPages = Math.ceil(first.total / pageSize)
    for (let p = 2; p <= totalPages && p <= 50; p++) {
      const next = await listDnc(orgId, { page: p, pageSize })
      rows.push(...next.rows)
    }

    const header = ["Name", "Phone", "Email", "SMS", "Email", "Calls", "Source", "Added"]
    const lines = [header.map(escapeCsv).join(",")]
    for (const b of rows) {
      const name = (b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed").trim()
      lines.push(
        [
          name,
          b.phone || "",
          b.email || "",
          smsOk(b) ? "OK" : "Off",
          emailOk(b) ? "OK" : "Off",
          callsOk(b) ? "OK" : "Off",
          deriveDncSource(b),
          addedAt(b) ? new Date(addedAt(b) as string).toISOString() : "",
        ]
          .map(escapeCsv)
          .join(","),
      )
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="do-not-contact.csv"',
      },
    })
  } catch (err: any) {
    console.error("[dnc] export error", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
