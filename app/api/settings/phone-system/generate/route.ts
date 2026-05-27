import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Polly voices offered for voicemail greetings. Danielle is the default.
const POLLY_VOICES = [
  { id: "Danielle", label: "Danielle (Female)", engine: "long-form" },
  { id: "Joanna", label: "Joanna (Female)", engine: "neural" },
  { id: "Kendra", label: "Kendra (Female)", engine: "neural" },
  { id: "Ruth", label: "Ruth (Female)", engine: "neural" },
  { id: "Matthew", label: "Matthew (Male)", engine: "neural" },
  { id: "Joey", label: "Joey (Male)", engine: "neural" },
  { id: "Stephen", label: "Stephen (Male)", engine: "neural" },
  { id: "Gregory", label: "Gregory (Male)", engine: "long-form" },
] as const;

const DEFAULT_VOICE_ID = "Danielle";
const GREETING_BUCKET = "voicemail-greetings";

async function requireAuth() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return Boolean(session);
}

// GET returns the list of available voices (for the settings UI dropdown).
export async function GET() {
  return NextResponse.json({ ok: true, voices: POLLY_VOICES, defaultVoiceId: DEFAULT_VOICE_ID });
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleRecordingUpload(request);
  }
  return handlePollyGenerate(request);
}

async function handlePollyGenerate(request: Request) {
  try {
    const body = (await request.json()) as {
      e164?: string;
      text?: string;
      voice_id?: string;
    };

    const e164 = body.e164?.trim();
    const text = body.text?.trim();
    const voiceId = body.voice_id?.trim() || DEFAULT_VOICE_ID;

    if (!e164 || !text) {
      return NextResponse.json({ ok: false, error: "Missing e164 or text" }, { status: 400 });
    }

    const voiceConfig = POLLY_VOICES.find((v) => v.id === voiceId);
    if (!voiceConfig) {
      return NextResponse.json({ ok: false, error: "Invalid voice_id" }, { status: 400 });
    }

    const polly = new PollyClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceConfig.id as VoiceId,
      Engine: voiceConfig.engine,
      SampleRate: "24000",
    });

    const result = await polly.send(command);
    if (!result.AudioStream) {
      return NextResponse.json({ ok: false, error: "Polly returned no audio" }, { status: 500 });
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of result.AudioStream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const path = `${e164}/preview-${Date.now()}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(GREETING_BUCKET)
      .upload(path, buffer, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const publicUrl = supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl;
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    return NextResponse.json({ ok: true, url: cacheBustedUrl, source: "polly", voice_id: voiceId });
  } catch (error) {
    console.error("[phone-system/generate] Polly error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "TTS generation failed" },
      { status: 500 },
    );
  }
}

async function handleRecordingUpload(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio") as File | null;
    const e164 = (formData.get("e164") as string | null)?.trim();

    if (!file || !e164) {
      return NextResponse.json({ ok: false, error: "Missing audio file or e164" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/webm";
    const ext = mimeType.includes("wav")
      ? "wav"
      : mimeType.includes("mp3") || mimeType.includes("mpeg")
        ? "mp3"
        : "webm";
    const contentType = ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : "audio/webm";

    const path = `${e164}/preview-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(GREETING_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const publicUrl = supabaseAdmin.storage.from(GREETING_BUCKET).getPublicUrl(path).data.publicUrl;
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    return NextResponse.json({ ok: true, url: cacheBustedUrl, source: "recorded" });
  } catch (error) {
    console.error("[phone-system/generate] Upload error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
