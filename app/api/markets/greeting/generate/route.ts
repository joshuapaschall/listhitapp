import { apiError } from "@/lib/api-error"
import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import { requirePermission } from "@/lib/permissions/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
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
    if (error) return apiError(error, 500, undefined, { ok: false });
    const url = `${supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl}?v=${ts}`;
    return NextResponse.json({ ok: true, url, source: "recorded" });
  }

  const body = await request.json();
  const scopeKey = typeof body.scopeKey === "string" ? body.scopeKey.trim() : "";
  const scopeType = body.scopeType === "number" ? "number" : "market";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId = typeof body.voice_id === "string" ? body.voice_id : DEFAULT_VOICE_ID;
  const voiceConfig = POLLY_VOICES.find((voice) => voice.id === voiceId)
    ?? POLLY_VOICES.find((voice) => voice.id === DEFAULT_VOICE_ID)
    ?? POLLY_VOICES[0];
  if (!scopeKey || !text) return NextResponse.json({ ok: false, error: "Missing scopeKey or text" }, { status: 400 });
  const pollyRegion = process.env.AWS_POLLY_REGION ?? process.env.AWS_REGION ?? process.env.AWS_SES_REGION ?? "us-east-1";
  const pollyAccessKeyId = process.env.AWS_POLLY_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_SES_ACCESS_KEY_ID ?? "";
  const pollySecretAccessKey = process.env.AWS_POLLY_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SES_SECRET_ACCESS_KEY ?? "";
  if (!pollyAccessKeyId || !pollySecretAccessKey) {
    return NextResponse.json({ ok: false, error: "Polly AWS credentials are not configured (set AWS_POLLY_ACCESS_KEY_ID / AWS_POLLY_SECRET_ACCESS_KEY)." }, { status: 500 });
  }

  const polly = new PollyClient({
    region: pollyRegion,
    credentials: {
      accessKeyId: pollyAccessKeyId,
      secretAccessKey: pollySecretAccessKey,
    },
  });
  const isSsml = text.trim().startsWith("<speak");
  const chunks: Uint8Array[] = [];
  try {
    const result = await polly.send(new SynthesizeSpeechCommand({
      Text: text,
      TextType: isSsml ? "ssml" : "text",
      OutputFormat: "mp3",
      VoiceId: voiceConfig.id as VoiceId,
      Engine: voiceConfig.engine,
      SampleRate: "24000",
    }));
    for await (const c of result.AudioStream as AsyncIterable<Uint8Array>) chunks.push(c);
  } catch (err) {
    console.error("[polly greeting] synth failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Polly synthesis failed" }, { status: 500 });
  }
  const path = `${scopeType === "market" ? "markets" : "numbers"}/${scopeKey}/preview-${ts}.mp3`;
  const { error } = await supabaseAdmin.storage.from(GREETING_BUCKET).upload(path, Buffer.concat(chunks), { contentType: "audio/mpeg", upsert: true });
  if (error) return apiError(error, 500, undefined, { ok: false });
  const url = `${supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl}?v=${ts}`;
  return NextResponse.json({ ok: true, url, source: "polly", voice_id: voiceConfig.id });
}
