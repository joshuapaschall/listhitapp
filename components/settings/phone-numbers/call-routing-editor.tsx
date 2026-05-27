"use client";

import { useMemo, useState } from "react";

type CallRoutingMode = "browser_only" | "browser_first_then_forward" | "forwarding_only";

interface Props {
  scopeId: string;
  callRoutingMode: CallRoutingMode;
  browserRingTimeoutSeconds: number;
  callForwardingNumber: string | null;
  onSaved: (next: {
    call_routing_mode: CallRoutingMode;
    browser_ring_timeout_seconds: number;
    call_forwarding_number: string | null;
  }) => void;
}

const descriptions: Record<CallRoutingMode, string> = {
  browser_only: "Calls ring in the browser for logged-in agents. No answer → voicemail.",
  browser_first_then_forward: "Ring the browser first; if no answer within the timeout, forward to your phone. Still no answer → voicemail.",
  forwarding_only: "Send calls straight to the forwarding number. No answer → voicemail.",
};

export default function CallRoutingEditor(props: Props) {
  const [mode, setMode] = useState<CallRoutingMode>(props.callRoutingMode);
  const [timeout, setTimeoutValue] = useState<number>(props.browserRingTimeoutSeconds);
  const [forwarding, setForwarding] = useState<string>(props.callForwardingNumber ?? "");
  const [status, setStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const needsForwarding = mode === "browser_first_then_forward" || mode === "forwarding_only";
  const showTimeout = mode === "browser_only" || mode === "browser_first_then_forward";
  const trimmedForwarding = useMemo(() => forwarding.trim(), [forwarding]);

  async function saveRouting() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/phone-system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          e164: props.scopeId,
          call_routing_mode: mode,
          browser_ring_timeout_seconds: timeout,
          call_forwarding_number: needsForwarding ? trimmedForwarding || null : null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Failed to save routing.");
      }
      props.onSaved({
        call_routing_mode: mode,
        browser_ring_timeout_seconds: Number(data.number?.browser_ring_timeout_seconds ?? timeout),
        call_forwarding_number: data.number?.call_forwarding_number ?? null,
      });
      setStatus({ type: "ok", message: data.warning ? `Saved. ${data.warning}` : "Routing saved." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Failed to save routing." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {(["browser_only", "browser_first_then_forward", "forwarding_only"] as CallRoutingMode[]).map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-lg border p-3 transition ${mode === value ? "border-[#10B981] bg-[#ECFDF5]" : "border-gray-200 hover:border-[#059669]"}`}
          >
            <input type="radio" className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
            <p className="font-medium text-gray-900">{value.replaceAll("_", " ")}</p>
            <p className="mt-1 text-sm text-gray-600">{descriptions[value]}</p>
          </label>
        ))}
      </div>

      {needsForwarding && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Forwarding Number (E.164)</label>
          <input
            value={forwarding}
            onChange={(e) => setForwarding(e.target.value)}
            placeholder="+15551234567"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]"
          />
          {!trimmedForwarding && <p className="text-sm text-amber-600">Forwarding number required for this routing mode.</p>}
        </div>
      )}

      {showTimeout && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Browser Ring Timeout (5–60 seconds)</label>
          <input
            type="number"
            min={5}
            max={60}
            value={timeout}
            onChange={(e) => setTimeoutValue(Math.max(5, Math.min(60, Number.parseInt(e.target.value || "5", 10))))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#10B981] focus:outline-none focus:ring-2 focus:ring-[#10B981]"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveRouting}
          disabled={saving}
          className="rounded-md bg-[#059669] px-4 py-2 text-sm font-medium text-white hover:bg-[#047857] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Routing"}
        </button>
        {status && <p className={`text-sm ${status.type === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{status.message}</p>}
      </div>
    </div>
  );
}
