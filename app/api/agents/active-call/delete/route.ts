export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { devBypassAgentAuth } from "@/lib/dev";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(_request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    );
  }
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    let {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      const authHeader = _request.headers.get("authorization") || ""
      const accessToken = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : null

      if (accessToken) {
        const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
        if (error) {
          return NextResponse.json(
            { ok: false, error: `Auth (bearer) failed: ${error.message}` },
            { status: 401 },
          )
        }
        user = data.user ?? null
      }
    }

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      )
    }


    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("agents")
      .select("id,telnyx_credential_id, sip_username, sip_password")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    const agentId = agent?.id;

    console.log("🧹 Deleting agent_active_calls record for agent:", agentId);

    if (!agentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from("agent_active_calls")
      .delete()
      .eq("agent_id", agentId);

    if (error) throw error;

    console.log("✅ Active call record deleted");

    return NextResponse.json({
      success: true,
      message: "Active call record deleted",
    });
  } catch (err: any) {
    console.error("[agents] route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
