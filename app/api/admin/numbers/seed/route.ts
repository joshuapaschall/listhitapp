import { NextResponse } from "next/server";
export const runtime = "nodejs";

// If you already have this helper, keep it:
import { supabaseAdmin } from "@/lib/supabase/admin";

// If you DON'T have supabaseAdmin, uncomment this tiny fallback instead:
// import { createClient } from "@supabase/supabase-js";
// const supabaseAdmin = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!,
//   { auth: { persistSession: false } }
// );

function normE164(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return /^\+\d{11,15}$/.test(e164) ? e164 : null;
}

export async function POST(req: Request) {
  // Admin bearer gate
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token || token !== process.env.ADMIN_TASKS_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orgId = (body?.org_id as string) || process.env.DEFAULT_ORG_ID || null;
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!orgId) return NextResponse.json({ error: "org_id_required" }, { status: 400 });
  if (!rows.length) return NextResponse.json({ error: "rows_required" }, { status: 400 });

  const upserts: { e164: string; org_id: string; label?: string | null }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const e164 = normE164(r?.e164);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    upserts.push({ e164, org_id: orgId, label: r?.label ?? null });
  }
  if (!upserts.length) return NextResponse.json({ error: "no_valid_numbers" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .upsert(upserts, { onConflict: "e164" })
    .select("e164, org_id, label, enabled");

  if (error) {
    console.error("inbound_numbers upsert error:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ count: data?.length ?? 0, items: data });
}
