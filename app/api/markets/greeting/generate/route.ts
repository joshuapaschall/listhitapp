import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import { requirePermission } from "@/lib/permissions/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireOrgContext } from "../../_shared";
import { DEFAULT_VOICE_ID, POLLY_VOICES } from "@/lib/voice/polly-voices";

const GREETING_BUCKET = "voicemail-greetings";

export async function GET() {
  const { user, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.markets");
  if (denied) return denied;
  return NextResponse.json({ ok: true, voices: POLLY_VOICES, defaultVoiceId: DEFAULT_VOICE_ID });
}

export async function POST(request: Request) {
  const { user, supabase } = await requireOrgContext();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(supabase, "settings.markets");
  if (denied) return denied;
  const contentType = request.headers.get("content-type") ?? "";
  const ts = Date.now();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("audio") as File | null;
    const scopeKey = String(formData.get("scopeKey") ?? "").trim();
    const scopeType = formData.get("scopeType") === "number" ? "number" : "market";
    if (!file || !scopeKey) return NextResponse.json({ ok: false, error: "Missing audio file or scopeKey" }, { status: 400 });
    const ext = file.type.includes("wav") ? "wav" : file.type.includes("mp3") || file.type.includes("mpeg") ? "mp3" : "webm";
    const path = `${scopeType === "market" ? "markets" : "numbers"}/${scopeKey}/preview-${ts}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(GREETING_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "audio/webm", upsert: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const url = `${supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl}?v=${ts}`;
    return NextResponse.json({ ok: true, url, source: "recorded" });
  }

  const body = await request.json();
  const scopeKey = typeof body.scopeKey === "string" ? body.scopeKey.trim() : "";
  const scopeType = body.scopeType === "number" ? "number" : "market";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : DEFAULT_VOICE_ID;
  const voiceConfig = POLLY_VOICES.find((voice) => voice.id === voiceId) ?? POLLY_VOICES[0];
  if (!scopeKey || !text) return NextResponse.json({ ok: false, error: "Missing scopeKey or text" }, { status: 400 });
  const polly = new PollyClient({ region: process.env.AWS_REGION ?? "us-east-1", credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "" } });
  const result = await polly.send(new SynthesizeSpeechCommand({ Text: text, OutputFormat: "mp3", VoiceId: voiceConfig.id as VoiceId, Engine: voiceConfig.engine, SampleRate: "24000" }));
  const chunks: Uint8Array[] = []; for await (const c of result.AudioStream as AsyncIterable<Uint8Array>) chunks.push(c);
  const path = `${scopeType === "market" ? "markets" : "numbers"}/${scopeKey}/preview-${ts}.mp3`;
  const { error } = await supabaseAdmin.storage.from(GREETING_BUCKET).upload(path, Buffer.concat(chunks), { contentType: "audio/mpeg", upsert: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const url = `${supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl}?v=${ts}`;
  return NextResponse.json({ ok: true, url, source: "polly", voice_id: voiceConfig.id });
}
