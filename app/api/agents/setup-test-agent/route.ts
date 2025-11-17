export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("setup-test-agent")

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not allowed in production" },
        { status: 403 }
      )
    }

    log("Starting test agent setup")

    const { data: existing } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("email", "agent1@company.com")
      .single()

    if (existing) {
      log("Agent already exists", existing.id)

      const needsPassword =
        existing.password_hash === "PLACEHOLDER_WILL_BE_SET_VIA_SQL" ||
        existing.password_hash === "TEMP_WILL_BE_SET"

      if (needsPassword) {
        log("Password needs to be set via SQL")
      }

      return NextResponse.json({
        message: "Test agent ready",
        agent: {
          id: existing.id,
          email: existing.email,
          display_name: existing.display_name,
          status: existing.status,
          has_credential:
            existing.telephony_credential_id !== "REPLACE_WITH_TELNYX_CREDENTIAL_ID",
        },
        next_steps: needsPassword
          ? [
              "1. Set password by running this SQL in Supabase:",
              "   UPDATE agents SET password_hash = crypt('test123', gen_salt('bf')) WHERE email = 'agent1@company.com';",
              "2. Then create Telnyx credential and update agent",
            ]
          : existing.telephony_credential_id === "REPLACE_WITH_TELNYX_CREDENTIAL_ID"
          ? [
              "1. Go to Telnyx Portal > Authentication > Credentials",
              "2. Create a new credential with username: agent1",
              "3. Copy the Credential ID",
              "4. Update using PUT request to /api/agents/setup-test-agent with {credentialId: 'YOUR_ID'}",
            ]
          : [
              "Agent is fully configured!",
              "Login at /agents/login with:",
              "Email: agent1@company.com",
              "Password: test123",
            ],
      })
    }

    log("Creating new test agent")

    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .insert({
        email: "agent1@company.com",
        password_hash: "TEMP_WILL_BE_SET",
        display_name: "Agent One",
        sip_username: "agent1",
        telephony_credential_id: "REPLACE_WITH_TELNYX_CREDENTIAL_ID",
        status: "offline",
      })
      .select()
      .single()

    if (error) throw error

    log("Agent created, password needs to be set via SQL")

    return NextResponse.json({
      message: "Test agent created successfully",
      agent: {
        id: agent.id,
        email: agent.email,
        display_name: agent.display_name,
        status: agent.status,
      },
      next_steps: [
        "1. Set password by running this SQL in Supabase:",
        "   UPDATE agents SET password_hash = crypt('test123', gen_salt('bf')) WHERE email = 'agent1@company.com';",
        "2. Go to Telnyx Portal > Authentication > Credentials",
        "3. Create a new credential with username: agent1",
        "4. Copy the Credential ID",
        "5. Update agent: UPDATE agents SET telephony_credential_id = 'YOUR_CRED_ID' WHERE email = 'agent1@company.com';",
      ],
    })
  } catch (err: any) {
    log("Error in setup", err)
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 }
    )
  }
  try {
    const { credentialId } = await request.json()

    if (!credentialId) {
      return NextResponse.json(
        { error: "credentialId is required" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        telephony_credential_id: credentialId,
        updated_at: new Date().toISOString(),
      })
      .eq("email", "agent1@company.com")
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      message: "Credential updated successfully",
      agent: data,
      ready: true,
      login_info: {
        url: "/agents/login",
        email: "agent1@company.com",
        password: "test123",
      },
    })
  } catch (err: any) {
    console.error("[agents] route error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    )
  }
}
