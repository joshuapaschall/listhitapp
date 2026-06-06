import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/permissions/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { supabaseAdmin } from "@/lib/supabase"
import { normalizePhone, hasContactInfo } from "@/lib/dedup-utils"
import { suppressBuyerSms } from "@/lib/sms/suppress"

type ImportUpdate = {
  id: string
  data: Record<string, any>
}

export async function POST(req: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
  const denied = await requirePermission(supabase, "buyers.import")
  if (denied) return denied

  try {
    const body = await req.json()
    const buyers = Array.isArray(body) ? body : body?.buyers
    const updates = Array.isArray(body?.updates) ? body.updates : []
    const insertedIds: string[] = []
    const updatedIds: string[] = []

    if (buyers !== undefined) {
      if (!Array.isArray(buyers)) {
        return NextResponse.json({ error: "buyers array required" }, { status: 400 })
      }

      if (buyers.length) {
        // Strip any client-supplied org_id and stamp the server-resolved org on every row.
        const rows = buyers
          .map((buyer: Record<string, any>) => {
            const { org_id: _ignoredOrgId, ...rest } = buyer ?? {}
            return { ...rest, org_id: orgId }
          })
          .filter((row) => hasContactInfo(row as any))
        const { data, error } = rows.length
          ? await supabase.from("buyers").insert(rows).select("id, phone")
          : { data: [] as { id: string }[], error: null }

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        insertedIds.push(...((data ?? []) as { id: string }[]).map((buyer) => buyer.id))

        // Pre-suppress any imported buyer whose number is already on the org's
        // DNC blocklist. Non-blocking — never fail the import on it.
        try {
          const inserted = (data ?? []) as { id: string; phone?: string | null }[]
          const phoneToId = new Map<string, string>()
          for (const b of inserted) {
            const normalized = normalizePhone(b.phone)
            if (normalized) phoneToId.set(normalized, b.id)
          }
          if (phoneToId.size) {
            const { data: dncRows } = await supabaseAdmin
              .from("dnc_phones")
              .select("normalized_phone")
              .eq("org_id", orgId)
              .in("normalized_phone", Array.from(phoneToId.keys()))
            for (const row of dncRows ?? []) {
              const matchedId = phoneToId.get((row as { normalized_phone: string }).normalized_phone)
              if (matchedId) await suppressBuyerSms(matchedId, "imported_dnc")
            }
          }
        } catch (presupErr) {
          console.error("[buyers/import] DNC pre-suppression failed (non-blocking)", presupErr)
        }
      }
    }

    for (const update of updates as ImportUpdate[]) {
      if (!update?.id || !update.data || Array.isArray(update.data) || typeof update.data !== "object") {
        return NextResponse.json({ error: "valid updates required" }, { status: 400 })
      }

      // Never let an update relocate a buyer to another org.
      const { org_id: _ignoredOrgId, ...updateData } = update.data
      const { data, error } = await supabase
        .from("buyers")
        .update(updateData)
        .eq("id", update.id)
        .select("id")
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data?.id) updatedIds.push(data.id)
    }

    if (buyers === undefined && updates.length === 0) {
      return NextResponse.json({ error: "buyers or updates required" }, { status: 400 })
    }

    return NextResponse.json({ ids: insertedIds, insertedIds, updatedIds }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 })
  }
}
