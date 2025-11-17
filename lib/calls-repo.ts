import { supabaseAdmin } from "@/lib/supabase"

export type SaveLegInput = {
  agentSessionId: string
  customerCallControlId: string
  status: "dialing" | "ringing" | "bridged" | "ended"
}

export async function saveCustomerLeg(i: SaveLegInput) {
  if (!supabaseAdmin) return
  await supabaseAdmin.from("calls_sessions").upsert(
    {
      agent_session_id: i.agentSessionId,
      customer_call_control_id: i.customerCallControlId,
      status: i.status,
    },
    { onConflict: "agent_session_id" }
  )
}

export async function markBridged(i: {
  agentSessionId: string
  customerCallControlId: string
}) {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from("calls_sessions")
    .update({ status: "bridged" })
    .eq("agent_session_id", i.agentSessionId)
    .eq("customer_call_control_id", i.customerCallControlId)
}

export async function publishToAgent(i: any) {
  // Optional: implement Supabase Realtime broadcasting
  if (!supabaseAdmin) return
  try {
    await supabaseAdmin.from("agent_events").insert({ data: i })
  } catch {}
}
