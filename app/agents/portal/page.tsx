import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAgent } from "@/lib/agent-auth";
import { AgentTelnyxProvider } from "@/components/agents/AgentTelnyxProvider";
import AgentPortalContent from "./AgentPortalContent";
import { missing } from "@/lib/env-check";
import { devBypassAgentAuth } from "@/lib/dev";

interface Agent {
  id: string;
  email: string;
  display_name: string;
  status: "available" | "busy" | "offline";
  sip_username: string | null;
}

export default async function AgentPortalPage() {
  const showDebug =
    process.env.NEXT_PUBLIC_SHOW_LOGIN_DEBUG === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const missingVoice = showDebug
    ? missing([
        "TELNYX_API_KEY",
        "CALL_CONTROL_APP_ID",
        "TELNYX_DEFAULT_CALLER_ID",
      ])
    : [];

  if (devBypassAgentAuth) {
    const agent: Agent = {
      id: "dev",
      email: "dev@local",
      display_name: "Dev Agent",
      status: "available",
      sip_username: null,
    };
    return (
      <AgentTelnyxProvider agent={agent}>
        <AgentPortalContent initialAgent={agent} missingVoice={missingVoice} />
      </AgentTelnyxProvider>
    );
  }

  let session: { id: string };
  try {
    session = await requireAgent();
  } catch {
    redirect("/agents/login");
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("id, email, display_name, status, sip_username")
    .eq("id", session.id)
    .single();

  if (error || !data) {
    redirect("/agents/login");
  }

  const agent: Agent = {
    id: data.id,
    email: data.email,
    display_name: data.display_name,
    status: data.status,
    sip_username: data.sip_username,
  };

  return (
    <AgentTelnyxProvider agent={agent}>
      <AgentPortalContent initialAgent={agent} missingVoice={missingVoice} />
    </AgentTelnyxProvider>
  );
}
