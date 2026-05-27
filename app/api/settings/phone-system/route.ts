import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_MODES = ["browser_only", "browser_first_then_forward", "forwarding_only"] as const;
const ALLOWED_SOURCES = ["polly", "recorded"] as const;

type RoutingMode = (typeof ALLOWED_MODES)[number];
type GreetingSource = (typeof ALLOWED_SOURCES)[number];

async function requireAuth() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return Boolean(session);
}

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const e164 = searchParams.get("e164")?.trim();

  const query = supabaseAdmin
    .from("inbound_numbers")
    .select("e164, label, enabled, call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds, voicemail_greeting_url, voicemail_greeting_source")
    .order("e164", { ascending: true });

  if (e164) {
    const { data, error } = await query.eq("e164", e164).maybeSingle();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, number: data ?? null });
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, numbers: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const e164 = typeof body.e164 === "string" ? body.e164.trim() : "";

  if (!e164) {
    return NextResponse.json({ ok: false, error: "Missing e164" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.call_routing_mode !== undefined) {
    if (typeof body.call_routing_mode !== "string" || !ALLOWED_MODES.includes(body.call_routing_mode as RoutingMode)) {
      return NextResponse.json({ ok: false, error: "Invalid call_routing_mode" }, { status: 400 });
    }
    update.call_routing_mode = body.call_routing_mode;
  }

  if (body.browser_ring_timeout_seconds !== undefined) {
    const parsed = Number.parseInt(String(body.browser_ring_timeout_seconds), 10);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json({ ok: false, error: "Invalid browser_ring_timeout_seconds" }, { status: 400 });
    }
    update.browser_ring_timeout_seconds = Math.max(5, Math.min(60, parsed));
  }

  if (body.call_forwarding_number !== undefined) {
    if (body.call_forwarding_number === null) {
      update.call_forwarding_number = null;
    } else if (typeof body.call_forwarding_number === "string") {
      const trimmed = body.call_forwarding_number.trim();
      if (!trimmed) {
        update.call_forwarding_number = null;
      } else if (!/^\+[0-9]+$/.test(trimmed)) {
        return NextResponse.json({ ok: false, error: "Invalid call_forwarding_number" }, { status: 400 });
      } else {
        update.call_forwarding_number = trimmed;
      }
    } else {
      return NextResponse.json({ ok: false, error: "Invalid call_forwarding_number" }, { status: 400 });
    }
  }

  if (body.voicemail_greeting_url !== undefined) {
    if (body.voicemail_greeting_url === null) {
      update.voicemail_greeting_url = null;
    } else if (typeof body.voicemail_greeting_url === "string") {
      update.voicemail_greeting_url = body.voicemail_greeting_url.trim() || null;
    } else {
      return NextResponse.json({ ok: false, error: "Invalid voicemail_greeting_url" }, { status: 400 });
    }
  }

  if (body.voicemail_greeting_source !== undefined) {
    if (body.voicemail_greeting_source === null) {
      update.voicemail_greeting_source = null;
    } else if (
      typeof body.voicemail_greeting_source === "string" &&
      ALLOWED_SOURCES.includes(body.voicemail_greeting_source as GreetingSource)
    ) {
      update.voicemail_greeting_source = body.voicemail_greeting_source;
    } else {
      return NextResponse.json({ ok: false, error: "Invalid voicemail_greeting_source" }, { status: 400 });
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("inbound_numbers")
    .update(update)
    .eq("e164", e164)
    .select("e164, label, enabled, call_routing_mode, call_forwarding_number, browser_ring_timeout_seconds, voicemail_greeting_url, voicemail_greeting_source")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let warning: string | undefined;
  if (
    updated &&
    (updated.call_routing_mode === "forwarding_only" || updated.call_routing_mode === "browser_first_then_forward") &&
    !updated.call_forwarding_number
  ) {
    warning = "No forwarding number set";
  }

  return NextResponse.json(warning ? { ok: true, number: updated, warning } : { ok: true, number: updated });
}
