import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/New_York";
const CONNECTED_STATUSES = new Set(["completed", "answered", "bridged"]);
const MISSED_STATUSES = new Set(["missed", "no_answer", "failed"]);

function getTodayRange(timeZone: string): { startIso: string; endIso: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const localStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const localEnd = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const zoneNow = new Date(now.toLocaleString("en-US", { timeZone }));
  const utcNow = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = utcNow.getTime() - zoneNow.getTime();

  return {
    startIso: new Date(localStart.getTime() + offsetMs).toISOString(),
    endIso: new Date(localEnd.getTime() + offsetMs).toISOString(),
  };
}

export async function GET() {
  try {
    const { startIso, endIso } = getTodayRange(APP_TIMEZONE);

    const { data, error } = await supabaseAdmin
      .from("calls")
      .select("started_at,status,duration_seconds,voicemail,voicemail_storage_path")
      .gte("started_at", startIso)
      .lt("started_at", endIso);

    if (error) {
      throw new Error(error.message);
    }

    const callsToday = data?.length ?? 0;
    let connectedCount = 0;
    let talkTimeTodaySeconds = 0;
    let missedToday = 0;
    let newVoicemails = 0;

    for (const call of data ?? []) {
      const status = call.status ?? "";
      if (CONNECTED_STATUSES.has(status)) {
        connectedCount += 1;
        talkTimeTodaySeconds += Number(call.duration_seconds ?? 0);
      }
      if (MISSED_STATUSES.has(status)) {
        missedToday += 1;
      }
      // TODO: If/when unread voicemail tracking exists on calls, only count unheard here.
      if (call.voicemail === true && call.voicemail_storage_path) {
        newVoicemails += 1;
      }
    }

    const connectedRateToday = callsToday > 0 ? connectedCount / callsToday : 0;

    return NextResponse.json({
      ok: true,
      stats: { callsToday, talkTimeTodaySeconds, connectedRateToday, missedToday, newVoicemails },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
