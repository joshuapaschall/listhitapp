export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  }
  const secret = req.headers.get("x-reset-secret") || "";
  if (!process.env.AGENT_RESET_SECRET || secret !== process.env.AGENT_RESET_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return NextResponse.json({ error: "email and newPassword required" }, { status: 400 });
    }
    const em = String(email).trim().toLowerCase();

    const { data: agent, error: findErr } = await supabaseAdmin
      .from("agents").select("id").ilike("email", em).maybeSingle();
    if (findErr) throw findErr;
    if (!agent) return NextResponse.json({ error: "No agent with that email" }, { status: 404 });

    const password_hash = bcrypt.hashSync(String(newPassword), 10);
    const { error: updErr } = await supabaseAdmin
      .from("agents").update({ password_hash }).eq("id", agent.id);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[agents/password/reset] error:", err);
    return NextResponse.json({ error: err?.message ?? "Unexpected server error" }, { status: 500 });
  }
}
