export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdmin } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const cookieClient = createRouteHandlerClient({ cookies });
  const {
    data: { user: cookieUser }
  } = await cookieClient.auth.getUser();

  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  let bearerUser: any = null;

  if (bearerToken && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdmin(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await admin.auth.getUser(bearerToken);
      if (!error) {
        bearerUser = data.user ?? null;
      }
    } catch (error) {
      console.error("[debug/auth] failed to resolve bearer user", error);
    }
  }

  return NextResponse.json({
    cookieUser: cookieUser ?? null,
    bearerPresent: Boolean(bearerToken),
    bearerUser: bearerUser ?? null
  });
}
