"use client";

import { useMemo, useState } from "react";

type CallRoutingMode = "browser_only" | "browser_first_then_forward" | "forwarding_only";

interface Props {
  scopeId: string;
  patchEndpoint: string;
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
  browser_only: "Calls ring in the browser for logged-in agents. No answer goes to voicemail.",
  browser_first_then_forward: "Ring browser first, then forward if no one answers.",
  forwarding_only: "Forward incoming calls directly to the configured number.",
};

export default function CallRoutingEditor(props: Props) {
  const [mode, setMode] = useState<CallRoutingMode>(props.callRoutingMode);
  const [timeout, setTimeoutValue] = useState<number>(props.browserRingTimeoutSeconds);
  const [forwarding, setForwarding] = useState<string>(props.callForwardingNumber ?? "");
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const needsForwarding = mode === "browser_first_then_forward" || mode === "forwarding_only";
  const showTimeout = mode === "browser_only" || mode === "browser_first_then_forward";
  const trimmedForwarding = useMemo(() => forwarding.trim(), [forwarding]);

  async function saveRouting() {
    setSaving(true);
    setStatus("");

    const payload: Record<string, unknown> = {
      call_routing_mode: mode,
      browser_ring_timeout_seconds: timeout,
      call_forwarding_number: needsForwarding ? trimmedForwarding || null : null,
    };

    if (props.patchEndpoint === "/api/settings/phone-system") {
      payload.e164 = props.scopeId;
    }

    const response = await fetch(props.patchEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok || !data?.ok) {
      setStatus(data?.error ?? "Failed to save routing.");
      return;
    }

    const row = data.number ?? data.market;
    props.onSaved({
      call_routing_mode: row.call_routing_mode,
      browser_ring_timeout_seconds: row.browser_ring_timeout_seconds,
      call_forwarding_number: row.call_forwarding_number,
    });

    setStatus(data.warning ? `Saved. ${data.warning}` : "Routing saved.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {(["browser_only", "browser_first_then_forward", "forwarding_only"] as CallRoutingMode[]).map((value) => (
          <label
            key={value}
            className={`cursor-pointer rounded-lg border p-3 transition ${mode === value ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-emerald-500"}`}
          >
            <input type="radio" className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
            <p className="text-sm font-medium text-gray-900">{value.replaceAll("_", " ")}</p>
            <p className="mt-1 text-xs text-gray-600">{descriptions[value]}</p>
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveRouting}
          disabled={saving}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Routing"}
        </button>
        {status ? <p className="text-sm text-gray-700">{status}</p> : null}
      </div>
    </div>
  );
}
