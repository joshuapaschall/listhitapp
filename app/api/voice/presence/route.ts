import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PresenceStatus = "online" | "offline";

interface PresenceBody {
  status: PresenceStatus;
  sip_username?: string | null;
  client_id: string;
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<PresenceBody>;
  if (!body.client_id || (body.status !== "online" && body.status !== "offline")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { error } = await supabase.from("user_presence").upsert(
    {
      user_id: user.id,
      status: body.status,
      sip_username: body.sip_username ?? null,
      client_id: body.client_id,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id,client_id" }
  );

  if (error) {
    return apiError(error, 500);
  }

  return NextResponse.json({ ok: true });
}
