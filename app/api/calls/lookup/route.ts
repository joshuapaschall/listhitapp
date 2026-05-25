export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone")?.trim() || "";
    if (!phone) {
      return NextResponse.json({ ok: true, name: null, number: null, pendingCallControlId: null });
    }

    const digits = phone.replace(/\D/g, "");
    const noCc = digits.startsWith("1") ? digits.slice(1) : digits;
    const cands = Array.from(new Set([digits, noCc].filter((d) => d.length >= 10)));

    let name: string | null = null;
    if (cands.length) {
      const orFilter = cands
        .flatMap((d) => [`phone_norm.eq.${d}`, `phone2_norm.eq.${d}`, `phone3_norm.eq.${d}`])
        .join(",");
      const { data: buyer } = await supabaseAdmin
        .from("buyers")
        .select("fname, lname, full_name")
        .or(orFilter)
        .limit(1)
        .maybeSingle();
      if (buyer) {
        const full = (buyer.full_name || `${buyer.fname ?? ""} ${buyer.lname ?? ""}`).trim();
        name = full.length ? full : null;
      }
    }

    // Most recent still-live inbound call from this number: gives the client the
    // PSTN (far-party) call_control_id used for in-call controls.
    let pendingCallControlId: string | null = null;
    if (cands.length) {
      const orFilter = cands.map((d) => `from_number.ilike.%${d}%`).join(",");
      const { data: call } = await supabaseAdmin
        .from("calls")
        .select("call_sid, status")
        .eq("direction", "inbound")
        .in("status", ["initiated", "answered"])
        .or(orFilter)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      pendingCallControlId = call?.call_sid ?? null;
    }

    return NextResponse.json({ ok: true, name, number: phone, pendingCallControlId });
  } catch (e) {
    return NextResponse.json({ ok: true, name: null, number: null, pendingCallControlId: null });
  }
}
