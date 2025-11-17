export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { devBypassAgentAuth } from "@/lib/dev";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(request: NextRequest) {
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
      const authHeader = request.headers.get("authorization") || ""
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

    if (!agentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customer_leg_id, agent_leg_id, consult_leg_id } = await request.json();

    if (!customer_leg_id || !agent_leg_id) {
      return NextResponse.json(
        { error: "Missing required leg IDs" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("agent_active_calls")
      .upsert(
        {
          agent_id: agentId,
          customer_leg_id,
          agent_leg_id,
          consult_leg_id: consult_leg_id || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "agent_id",
        },
      );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Call leg IDs stored successfully",
    });
  } catch (err: any) {
    console.error("[agents] route error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
