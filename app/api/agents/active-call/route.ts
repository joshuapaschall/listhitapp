export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { devBypassAgentAuth } from "@/lib/dev";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req: Request) {
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
      const authHeader = req.headers.get("authorization") || ""
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
    const { data: activeCall, error } = await supabaseAdmin
      .from("agent_active_calls")
      .select("customer_leg_id, agent_leg_id, consult_leg_id")
      .eq("agent_id", agentId)
      .single();

    if (error || !activeCall) {
      return NextResponse.json({ active_call: null });
    }

    return NextResponse.json({
      active_call: {
        customerLegId: activeCall.customer_leg_id,
        agentLegId: activeCall.agent_leg_id,
        consultLegId: activeCall.consult_leg_id,
      },
    });
  } catch (err: any) {
    console.error("[agents] route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
