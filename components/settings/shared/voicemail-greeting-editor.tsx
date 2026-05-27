"use client";

import { useEffect, useRef, useState } from "react";

type GreetingSource = "polly" | "recorded" | null;

interface VoiceOption {
  id: string;
  label: string;
  engine: string;
}

interface Props {
  scopeId: string;
  patchEndpoint: string;
  generateEndpoint: string;
  scopeType?: "market" | "number";
  currentUrl: string | null;
  currentSource: GreetingSource;
  voices: VoiceOption[];
  onSaved: (url: string, source: "polly" | "recorded") => void;
  onRemoved: () => void;
}

export default function VoicemailGreetingEditor({
  scopeId,
  patchEndpoint,
  generateEndpoint,
  scopeType = "number",
  currentUrl,
  currentSource,
  voices,
  onSaved,
  onRemoved,
}: Props) {
  const [tab, setTab] = useState<"ai" | "record">("ai");
  const [text, setText] = useState(
    "Hi, you've reached our acquisitions team. Please leave your name, number, and property address, and we'll call you back as soon as possible.",
  );
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? "Danielle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<"polly" | "recorded" | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (voices.length > 0 && !voices.find((voice) => voice.id === voiceId)) {
      setVoiceId(voices[0].id);
    }
  }, [voiceId, voices]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  async function save(payload: Record<string, unknown>) {
    const body: Record<string, unknown> = { ...payload };
    if (patchEndpoint === "/api/settings/phone-system") {
      body.e164 = scopeId;
    }

    const response = await fetch(patchEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.json().then((data) => ({ data, ok: response.ok }));
  }

  async function generateJson() {
    const payload: Record<string, unknown> = {
      text,
      voice_id: voiceId,
    };

    if (generateEndpoint === "/api/settings/phone-system/generate") {
      payload.e164 = scopeId;
    } else {
      payload.scopeKey = scopeId;
      payload.scopeType = scopeType;
    }

    const response = await fetch(generateEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.json().then((data) => ({ data, ok: response.ok }));
  }

  async function generateUpload() {
    if (!recordingBlob) return;

    const formData = new FormData();
    formData.append("audio", new File([recordingBlob], "preview.webm", { type: "audio/webm" }));

    if (generateEndpoint === "/api/settings/phone-system/generate") {
      formData.append("e164", scopeId);
    } else {
      formData.append("scopeKey", scopeId);
      formData.append("scopeType", scopeType);
    }

    const response = await fetch(generateEndpoint, {
      method: "POST",
      body: formData,
    });

    return response.json().then((data) => ({ data, ok: response.ok }));
  }

  return (
    <div className="space-y-4">
      {currentUrl && (
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium text-gray-900">
            Current greeting
            <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              {currentSource === "recorded" ? "Recorded" : "AI Voice"}
            </span>
          </p>
          <audio controls className="mt-2 w-full" src={currentUrl} />
          <button
            className="mt-2 text-sm text-rose-700 underline"
            onClick={async () => {
              const { ok, data } = await save({ voicemail_greeting_url: null, voicemail_greeting_source: null });
              if (ok && data?.ok) {
                onRemoved();
                setStatus("Greeting removed.");
              }
            }}
          >
            Remove
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button className={`rounded px-3 py-1.5 text-sm ${tab === "ai" ? "bg-emerald-600 text-white" : "bg-gray-100"}`} onClick={() => setTab("ai")}>AI Voice</button>
        <button className={`rounded px-3 py-1.5 text-sm ${tab === "record" ? "bg-emerald-600 text-white" : "bg-gray-100"}`} onClick={() => setTab("record")}>Record Your Own</button>
      </div>

      {tab === "ai" ? (
        <div className="space-y-2">
          <textarea className="w-full rounded border px-3 py-2 text-sm" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          <select className="w-full rounded border px-3 py-2 text-sm" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.label}</option>
            ))}
          </select>
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const { ok, data } = await generateJson();
              setBusy(false);
              if (!ok || !data?.ok) return setStatus(data?.error ?? "Failed to generate preview.");
              setPreviewUrl(data.url);
              setPreviewSource("polly");
              setStatus("Preview generated — not live yet.");
            }}
          >
            Generate Preview
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white"
            onClick={async () => {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              const recorder = new MediaRecorder(stream);
              mediaRecorderRef.current = recorder;
              const chunks: Blob[] = [];

              recorder.ondataavailable = (event) => chunks.push(event.data);
              recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                setRecordingBlob(blob);
                if (recordingUrl) URL.revokeObjectURL(recordingUrl);
                setRecordingUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach((track) => track.stop());
              };

              recorder.start();
              setStatus("Recording...");
            }}
          >
            Start Recording
          </button>
          <button className="rounded bg-gray-200 px-3 py-2 text-sm" onClick={() => mediaRecorderRef.current?.stop()}>Stop</button>
          {recordingUrl ? <audio controls className="w-full" src={recordingUrl} /> : null}
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
            disabled={!recordingBlob || busy}
            onClick={async () => {
              setBusy(true);
              const generated = await generateUpload();
              setBusy(false);
              if (!generated) return;
              if (!generated.ok || !generated.data?.ok) return setStatus(generated.data?.error ?? "Failed to upload preview.");
              setPreviewUrl(generated.data.url);
              setPreviewSource("recorded");
              setStatus("Preview uploaded — not live yet.");
            }}
          >
            Upload Preview
          </button>
        </div>
      )}

      {previewUrl ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-700">Preview — not live yet</p>
          <audio controls className="mt-2 w-full" src={previewUrl} />
        </div>
      ) : null}

      <button
        className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
        disabled={!previewUrl || busy}
        onClick={async () => {
          if (!previewUrl || !previewSource) return;
          setBusy(true);
          const { ok, data } = await save({ voicemail_greeting_url: previewUrl, voicemail_greeting_source: previewSource });
          setBusy(false);
          if (!ok || !data?.ok) return setStatus(data?.error ?? "Failed to save greeting.");
          onSaved(previewUrl, previewSource);
          setPreviewUrl(null);
          setPreviewSource(null);
          setStatus("Saved as active.");
        }}
      >
        Save as Active Greeting
      </button>
      {status ? <p className="text-sm text-gray-700">{status}</p> : null}
    </div>
  );
}
