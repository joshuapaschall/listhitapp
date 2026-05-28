import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireOrgContext() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, orgId: null };

  const { data: row } = await supabaseAdmin
    .from("inbound_numbers")
    .select("org_id")
    .limit(1)
    .maybeSingle();

  let orgId: string | null = row?.org_id ?? null;

  if (!orgId) {
    const envOrg = process.env.DEFAULT_ORG_ID;
    if (envOrg && UUID_RE.test(envOrg)) orgId = envOrg;
  }

  return { user, orgId };
}
