export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";

const EMPTY = { ok: true, name: null, number: null, pendingCallControlId: null };

async function buyerNameByPhone(
  supabase: Awaited<ReturnType<typeof requireOrgContext>>["supabase"],
  phone: string,
): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  const noCc = digits.startsWith("1") ? digits.slice(1) : digits;
  const cands = Array.from(new Set([digits, noCc].filter((d) => d.length >= 10)));
  if (!cands.length) return null;
  const orFilter = cands
    .flatMap((d) => [`phone_norm.eq.${d}`, `phone2_norm.eq.${d}`, `phone3_norm.eq.${d}`])
    .join(",");
  const { data: buyer } = await supabase
    .from("buyers")
    .select("fname, lname, full_name")
    .or(orFilter)
    .limit(1)
    .maybeSingle();
  if (!buyer) return null;
  const full = (buyer.full_name || `${buyer.fname ?? ""} ${buyer.lname ?? ""}`).trim();
  return full.length ? full : null;
}

export async function GET(request: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 });

    const sp = request.nextUrl.searchParams;
    const phoneRaw = sp.get("phone")?.trim() || "";
    const recent = sp.get("recent") === "inbound";
    const phoneIsReal = phoneRaw.replace(/\D/g, "").length >= 10;

    // Mode A: caller number known (outbound, or a future inbound where the SDK
    // provides a real number). Resolve the name directly.
    if (phoneIsReal && !recent) {
      const name = await buyerNameByPhone(supabase, phoneRaw);
      let pendingCallControlId: string | null = null;
      const digits = phoneRaw.replace(/\D/g, "");
      const noCc = digits.startsWith("1") ? digits.slice(1) : digits;
      const cands = Array.from(new Set([digits, noCc]));
      const orFilter = cands.map((d) => `from_number.ilike.%${d}%`).join(",");
      const { data: call } = await supabase
        .from("calls")
        .select("call_sid")
        .eq("direction", "inbound")
        .in("status", ["initiated", "answered"])
        .or(orFilter)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      pendingCallControlId = call?.call_sid ?? null;
      return NextResponse.json({ ok: true, name, number: phoneRaw, pendingCallControlId });
    }

    // Mode B: inbound with no usable SDK number. Find the most-recent live inbound
    // call row (written by the voice webhook on ring) — it holds the real caller
    // number, buyer match, and the PSTN far-leg call_control_id.
    const { data: call } = await supabase
      .from("calls")
      .select("call_sid, from_number, buyer_id")
      .eq("direction", "inbound")
      .in("status", ["initiated", "answered"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!call) return NextResponse.json(EMPTY);

    let name: string | null = null;
    if (call.buyer_id) {
      const { data: buyer } = await supabase
        .from("buyers")
        .select("fname, lname, full_name")
        .eq("id", call.buyer_id)
        .maybeSingle();
      if (buyer) {
        const full = (buyer.full_name || `${buyer.fname ?? ""} ${buyer.lname ?? ""}`).trim();
        name = full.length ? full : null;
      }
    }
    if (!name && call.from_number) name = await buyerNameByPhone(supabase, call.from_number);

    return NextResponse.json({
      ok: true,
      name,
      number: call.from_number ?? null,
      pendingCallControlId: call.call_sid ?? null,
    });
  } catch {
    return NextResponse.json(EMPTY);
  }
}
