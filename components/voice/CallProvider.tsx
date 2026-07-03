"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CallWidget } from "@/components/voice/CallWidget";
import { IncomingRingtone } from "@/components/voice/IncomingRingtone";
import { Call, TelnyxRTC } from "@telnyx/webrtc";
import { usePermissions } from "@/hooks/use-permissions";
import { supabaseBrowser } from "@/lib/supabase-browser";
// Type-only import so the Twilio SDK is never bundled/evaluated on the server —
// the engine module (and @twilio/voice-sdk) is dynamically imported client-side
// only when an org is routed to Twilio voice.
import type { TwilioVoiceEngine } from "@/components/voice/engines/twilio-voice-engine";

type CallStatus = "idle" | "connecting" | "on-call" | "error";

type VoiceProvider = "telnyx" | "twilio";

export interface CallContextValue {
  device: TelnyxRTC | null;
  status: CallStatus;
  activeCall: Call | null;
  incomingCall: Call | null;
  isMuted: boolean;
  isOnHold: boolean;
  customerLegId: string | null;
  currentContact: { name?: string; number?: string } | null;
  setCurrentContact: React.Dispatch<React.SetStateAction<{ name?: string; number?: string } | null>>;
  connectCall: (number: string, callerIdNumber?: string) => Promise<void>;
  makeCall: (destination: string, buyerId?: string, fromNumber?: string) => Promise<any>;
  answerCall: () => void;
  disconnectCall: () => void;
  toggleMute: () => void;
  unmute: () => void;
  toggleHold: () => Promise<void>;
  unhold: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  transfer: (number: string) => Promise<void>;
  sendDTMF: (digits: string) => void;
  joinConference: (conferenceId?: string) => Promise<void>;
  leaveConference: () => Promise<void>;
  addToConference: (phoneNumber: string) => Promise<void>;
  dialerOpen: boolean;
  setDialerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openDialer: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export async function getAccessToken() {
  const supabase = supabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in required");
  return session.access_token;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<TelnyxRTC | null>(null);
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [customerLegId, setCustomerLegId] = useState<string | null>(null);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<{ name?: string; number?: string } | null>(null);
  // Which voice engine this org uses. null while /api/voice/provider is loading —
  // neither engine spins up until it resolves, so nothing dials the wrong rail.
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider | null>(null);
  const [twilioReady, setTwilioReady] = useState(false);
  const twilioEngineRef = useRef<TwilioVoiceEngine | null>(null);
  const { can, loading: permissionsLoading } = usePermissions();
  const canMakeReceiveCalls = can("calls.make_receive");
  const activeCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const conferenceIdRef = useRef<string | null>(null);
  const sipUsernameRef = useRef<string | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Receptionist (server-originated) outbound state. When we POST /api/calls the
  // server dials the prospect AND dials this browser; the browser's own SIP leg
  // must be auto-answered (not shown as "incoming"). These refs track that.
  const outboundPendingRef = useRef(false);
  const outboundCallIdRef = useRef<string | null>(null);
  const prospectCallControlIdRef = useRef<string | null>(null);
  const suppressUntilRef = useRef<number>(0);
  const bridgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const customerLegIdRef = useRef<string | null>(null);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { customerLegIdRef.current = customerLegId; }, [customerLegId]);


  const reportPresence = useCallback((presenceStatus: "online" | "offline", useBeacon = false) => {
    const payload = {
      status: presenceStatus,
      sip_username: sipUsernameRef.current,
      client_id: clientIdRef.current,
    };

    if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        navigator.sendBeacon("/api/voice/presence", blob);
        return;
      } catch {}
    }

    fetch("/api/voice/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: useBeacon,
    }).catch(() => {});
  }, []);

  // Resolve the org's voice engine once on mount. Defaults to telnyx on any error
  // (fail-safe — matches the server pin philosophy).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/voice/provider", { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!cancelled) setVoiceProvider(json?.provider === "twilio" ? "twilio" : "telnyx");
      } catch {
        if (!cancelled) setVoiceProvider("telnyx");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let created: TelnyxRTC | null = null;
    let mounted = true;

    // Telnyx engine only — a Twilio-routed org (or the loading state) never spins
    // up TelnyxRTC. This enable-condition is the ONLY change to the Telnyx path;
    // its body below is byte-for-byte unchanged.
    if (voiceProvider !== "telnyx") return undefined;
    if (permissionsLoading) return undefined;
    if (!canMakeReceiveCalls) {
      setStatus("idle");
      return undefined;
    }

    const init = async () => {
      try {
        const res = await fetch("/api/telnyx/webrtc-credentials", { method: "GET", cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.login || !json?.password) throw new Error(json?.error || "Failed to fetch WebRTC credentials");

        sipUsernameRef.current = typeof json?.login === "string" ? json.login : null;

        created = new TelnyxRTC({ login: json.login, password: json.password } as any);
        // Use a non-React audio element. A React-rendered element carries a
        // __reactFiber$ circular reference that crashes the SDK's JSON.stringify
        // when it sends the SDP/ICE, preventing the INVITE from ever being sent.
        let remoteAudioEl = document.getElementById("telnyx-remote-audio") as HTMLAudioElement | null;
        if (!remoteAudioEl) {
          remoteAudioEl = document.createElement("audio");
          remoteAudioEl.id = "telnyx-remote-audio";
          remoteAudioEl.autoplay = true;
          (remoteAudioEl as any).playsInline = true;
          remoteAudioEl.style.display = "none";
          document.body.appendChild(remoteAudioEl);
        }
        (created as any).remoteElement = remoteAudioEl;

        created.on("telnyx.ready", () => {
          if (!mounted) return;
          setStatus("idle");
          setCurrentContact(null);
          reportPresence("online");
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => reportPresence("online"), 30000);
          created?.enableMicrophone?.();
        });

        created.on("telnyx.error", () => {
          if (!mounted) return;
          setStatus("error");
        });

        created.on("telnyx.socket.close", () => {
          reportPresence("offline");
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        });

        created.on("telnyx.notification", (n: any) => {
          if (!mounted || !n?.call) return;
          const call = n.call as Call;
          const state = String((call as any).state || "").toLowerCase();
          const callId = (call as any)?.id as string | undefined;

          // Ignore spurious SIP notifications briefly after we auto-answer our own
          // outbound leg (the bridge can emit a second INVITE we must not act on).
          if (suppressUntilRef.current > Date.now() && callId && callId !== outboundCallIdRef.current) {
            return;
          }

          // Auto-answer OUR OWN outbound leg. After POST /api/calls, the server
          // dials this browser; that leg arrives looking like an inbound call.
          // Because an outbound is pending and we haven't claimed a leg yet, this
          // is ours — answer it silently instead of showing the incoming UI.
          if (
            outboundPendingRef.current &&
            !outboundCallIdRef.current &&
            callId &&
            (n.type === "call.received" || state === "ringing" || state === "active")
          ) {
            outboundCallIdRef.current = callId;
            outboundPendingRef.current = false;
            if (bridgeTimeoutRef.current) { clearTimeout(bridgeTimeoutRef.current); bridgeTimeoutRef.current = null; }
            suppressUntilRef.current = Date.now() + 5000;
            try { (call as any)?.answer?.(); } catch {}
            setActiveCall(call);
            setIncomingCall(null);
            setStatus("on-call");
            return;
          }

          const isOurOutbound = !!callId && callId === outboundCallIdRef.current;
          if (!isOurOutbound && (n.type === "call.received" || (n.type === "callUpdate" && state === "ringing" && call.direction !== "outbound"))) {
            setIncomingCall(call);
            setStatus("connecting");
            // Resolve caller identity. On SIP-transferred inbound legs the SDK's
            // callerNumber is the SIP username (e.g. "listhitapp"), NOT the caller's
            // phone. Detect a non-phone value and instead resolve from the live
            // inbound `calls` row the webhook wrote on ring (real number + buyer +
            // PSTN far-leg call_control_id). Retry once for the write/ring race.
            const opts = (call as any)?.options || {};
            const sdkNumber: string = opts.callerNumber || opts.remoteCallerNumber || "";
            const sdkNumberIsReal = sdkNumber.replace(/\D/g, "").length >= 10;
            const lookupUrl = sdkNumberIsReal
              ? `/api/calls/lookup?phone=${encodeURIComponent(sdkNumber)}`
              : `/api/calls/lookup?recent=inbound`;
            setCurrentContact({ number: sdkNumberIsReal ? sdkNumber : undefined });
            const applyEnrichment = (d: any): boolean => {
              if (!mounted || !d) return false;
              if (d.number || d.name) {
                setCurrentContact({ name: d.name || undefined, number: d.number || (sdkNumberIsReal ? sdkNumber : undefined) });
              }
              if (d.pendingCallControlId && !prospectCallControlIdRef.current) {
                prospectCallControlIdRef.current = d.pendingCallControlId;
                setCustomerLegId(d.pendingCallControlId);
              }
              return !!(d.number || d.name || d.pendingCallControlId);
            };
            fetch(lookupUrl, { cache: "no-store" })
              .then((r) => r.json())
              .then((d) => {
                const got = applyEnrichment(d);
                if (!got && !sdkNumberIsReal) {
                  // Race: webhook row may not be written yet. Retry once.
                  setTimeout(() => {
                    if (!mounted) return;
                    fetch(`/api/calls/lookup?recent=inbound`, { cache: "no-store" })
                      .then((r) => r.json())
                      .then(applyEnrichment)
                      .catch(() => {});
                  }, 700);
                }
              })
              .catch(() => {});
            return;
          }
          if (n.type === "callUpdate") {
            const controlId = (call as any)?.telnyxIDs?.telnyxCallControlId || null;
            // For our outbound, controls must act on the prospect A-leg (set in
            // dialInternal), so don't overwrite it with this browser leg's id.
            if (!prospectCallControlIdRef.current && controlId) setCustomerLegId(controlId);
            if (state === "active") {
              setActiveCall(call);
              setIncomingCall(null);
              setStatus("on-call");
              window.dispatchEvent(new CustomEvent("telnyxCallConnected", { detail: { call } }));
            } else if (["hangup", "destroy", "purge"].includes(state)) {
              setActiveCall(null);
              setIncomingCall(null);
              setIsMuted(false);
              setIsOnHold(false);
              setCustomerLegId(null);
              outboundCallIdRef.current = null;
              outboundPendingRef.current = false;
              prospectCallControlIdRef.current = null;
              suppressUntilRef.current = 0;
              if (bridgeTimeoutRef.current) { clearTimeout(bridgeTimeoutRef.current); bridgeTimeoutRef.current = null; }
              setStatus("idle");
              setCurrentContact(null);
            }
          }
        });

        created.connect();
        setDevice(created);
      } catch {
        if (mounted) setStatus("error");
      }
    };
    init();

    return () => {
      mounted = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      reportPresence("offline", true);
      try { created?.disconnect(); } catch {}
      setDevice(null);
    };
  }, [voiceProvider, canMakeReceiveCalls, permissionsLoading, reportPresence]);

  // Twilio engine (direct-dial browser calling). Parallel to the Telnyx effect;
  // only one runs per org. The engine module is dynamically imported so the Twilio
  // SDK never loads on the server or for Telnyx orgs.
  useEffect(() => {
    if (voiceProvider !== "twilio") return undefined;
    if (permissionsLoading) return undefined;
    if (!canMakeReceiveCalls) {
      setStatus("idle");
      return undefined;
    }

    let disposed = false;
    let engine: TwilioVoiceEngine | null = null;
    (async () => {
      const { TwilioVoiceEngine } = await import("@/components/voice/engines/twilio-voice-engine");
      if (disposed) return;
      engine = new TwilioVoiceEngine({
        onStatus: (s) => { if (!disposed) setStatus(s); },
        onReady: (ready) => {
          if (disposed) return;
          setTwilioReady(ready);
          if (!ready) setActiveCall(null);
        },
        onActiveCall: (call) => { if (!disposed) setActiveCall(call as any); },
        onMuted: (m) => { if (!disposed) setIsMuted(m); },
      });
      twilioEngineRef.current = engine;
      await engine.init();
    })();

    return () => {
      disposed = true;
      twilioEngineRef.current = null;
      setTwilioReady(false);
      setStatus("connecting");
      setActiveCall(null);
      setIsMuted(false);
      setIsOnHold(false);
      engine?.destroy();
    };
  }, [voiceProvider, canMakeReceiveCalls, permissionsLoading]);

  const dialInternal = useCallback(async (
    destination: string,
    opts?: { buyerId?: string | null; from?: string | null },
  ) => {
    if (!device) throw new Error("Phone not ready");
    // `from` is sent ONLY when the user explicitly picked a caller ID; otherwise
    // the server resolves it (sticky → default app-assigned number).
    const explicitFrom = (opts?.from || "").trim();
    const buyerId = opts?.buyerId ?? null;

    // Receptionist model: the SERVER places the outbound call. It dials the
    // prospect (A-leg) and this browser (B-leg), then bridges them. The browser
    // B-leg is auto-answered in the telnyx.notification handler above.
    outboundPendingRef.current = true;
    outboundCallIdRef.current = null;
    prospectCallControlIdRef.current = null;
    setStatus("connecting");

    let res: Response;
    try {
      res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: destination,
          buyerId,
          ...(explicitFrom ? { from: explicitFrom } : {}),
        }),
        cache: "no-store",
      });
    } catch (e) {
      outboundPendingRef.current = false;
      setStatus("error");
      throw e;
    }

    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.ok || !json?.callControlId) {
      outboundPendingRef.current = false;
      setStatus("error");
      throw new Error(json?.error || "Failed to place call");
    }

    // The prospect (A-leg) control id is what call controls (hold/transfer/record)
    // must act on. Remember it for this call.
    prospectCallControlIdRef.current = json.callControlId as string;
    setCustomerLegId(json.callControlId as string);

    // Safety net: if the browser leg never arrives, stop "connecting" after 20s.
    if (bridgeTimeoutRef.current) clearTimeout(bridgeTimeoutRef.current);
    bridgeTimeoutRef.current = setTimeout(() => {
      if (outboundPendingRef.current) {
        outboundPendingRef.current = false;
        setActiveCall(null);
        setStatus("idle");
      }
    }, 20000);
  }, [device]);

  const connectCall = useCallback(async (number: string, callerIdNumber?: string) => {
    if (voiceProvider === "twilio") {
      setCurrentContact({ number });
      await twilioEngineRef.current?.makeCall(number);
      return;
    }
    await dialInternal(number, { from: callerIdNumber });
  }, [dialInternal, voiceProvider]);

  const makeCall = useCallback(async (destination: string, buyerId?: string, fromNumber?: string) => {
    if (voiceProvider === "twilio") {
      // Caller ID is server-enforced by the TwiML webhook — fromNumber is ignored.
      setCurrentContact({ number: destination });
      await twilioEngineRef.current?.makeCall(destination);
      return { ok: true, buyerId: buyerId || null };
    }
    await dialInternal(destination, { buyerId, from: fromNumber });
    return { ok: true, buyerId: buyerId || null };
  }, [dialInternal, voiceProvider]);

  const answerCall = useCallback(() => {
    if (voiceProvider === "twilio") {
      console.warn("[twilio-voice] answerCall not yet supported on Twilio voice");
      return;
    }
    const call = incomingCall || activeCallRef.current;
    (call as any)?.answer?.();
    if (call) setActiveCall(call);
  }, [incomingCall, voiceProvider]);

  const disconnectCall = useCallback(() => {
    if (voiceProvider === "twilio") {
      try { twilioEngineRef.current?.disconnect(); } catch {}
      setActiveCall(null);
      setIncomingCall(null);
      setIsMuted(false);
      setIsOnHold(false);
      setStatus("idle");
      setCurrentContact(null);
      return;
    }
    const call = activeCallRef.current || incomingCallRef.current;
    // Declining a ringing inbound leg hangs up the browser B-leg; the telnyx-voice webhook
    // detects the unanswered transfer (call_rejected) and routes the caller to voicemail on
    // the surviving PSTN A-leg. Ring-timeout is handled the same way server-side.
    try { (call as any)?.hangup?.(); } catch {}

    // The SDK hangup only ends the browser leg. In the receptionist model the far
    // PSTN leg (outbound prospect or inbound customer) keeps ringing/connected
    // unless we tear it down server-side. Fire-and-forget hangup on every known
    // far-leg control id.
    const farLegIds = Array.from(
      new Set(
        [prospectCallControlIdRef.current, customerLegIdRef.current].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    for (const id of farLegIds) {
      try {
        fetch(`/api/calls/${encodeURIComponent(id)}/hangup`, { method: "POST" }).catch(() => {});
      } catch {}
    }
    prospectCallControlIdRef.current = null;
    setCustomerLegId(null);

    setActiveCall(null);
    setIncomingCall(null);
    setStatus("idle");
    setCurrentContact(null);
  }, [voiceProvider]);

  const toggleMute = useCallback(() => {
    if (voiceProvider === "twilio") {
      const next = !isMuted;
      twilioEngineRef.current?.setMuted(next); // engine reports muted → setIsMuted(next)
      return;
    }
    const call = activeCallRef.current as any;
    if (!call) return;
    // Drive the toggle from OUR tracked state, not the SDK's isAudioMuted
    // (which is not reliably exposed and can leave the button stuck).
    setIsMuted((prev) => {
      if (prev) { call.unmuteAudio?.(); } else { call.muteAudio?.(); }
      return !prev;
    });
  }, [voiceProvider, isMuted]);
  const unmute = useCallback(() => {
    if (voiceProvider === "twilio") { twilioEngineRef.current?.setMuted(false); setIsMuted(false); return; }
    (activeCallRef.current as any)?.unmuteAudio?.(); setIsMuted(false);
  }, [voiceProvider]);

  const callControlId = () => (activeCallRef.current as any)?.telnyxIDs?.telnyxCallControlId;
  // Far party's PSTN leg — prospect (outbound) or caller (inbound). Hold/transfer
  // act on THIS leg so the CALLER hears hold music / gets transferred.
  const farLegId = () => prospectCallControlIdRef.current || callControlId();

  const toggleHold = useCallback(async () => {
    if (voiceProvider === "twilio") {
      // Interim mute-as-hold (real hold with hold music is V3).
      const next = !isOnHold;
      twilioEngineRef.current?.setHold(next);
      setIsOnHold(next);
      return;
    }
    const id = farLegId();
    if (!id) throw new Error("No call control id");
    const action = isOnHold ? "unhold" : "hold";
    const res = await fetch(`/api/calls/${id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (res.ok) setIsOnHold(!isOnHold);
  }, [isOnHold, voiceProvider]);

  const unhold = useCallback(async () => {
    if (voiceProvider === "twilio") { twilioEngineRef.current?.setHold(false); setIsOnHold(false); return; }
    const id = farLegId();
    if (!id) return;
    await fetch(`/api/calls/${id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unhold" }) });
    setIsOnHold(false);
  }, [voiceProvider]);

  const startRecording = useCallback(async () => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] startRecording not yet supported on Twilio voice"); return; }
    const id = callControlId();
    if (!id) return;
    await fetch(`/api/calls/${id}/record_start`, { method: "POST" });
  }, [voiceProvider]);

  const stopRecording = useCallback(async () => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] stopRecording not yet supported on Twilio voice"); return; }
    const id = callControlId();
    if (!id) return;
    await fetch(`/api/calls/${id}/record_stop`, { method: "POST" });
  }, [voiceProvider]);

  const transfer = useCallback(async (number: string) => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] transfer not yet supported on Twilio voice"); return; }
    const id = farLegId();
    if (!id) throw new Error("No call control id");
    const res = await fetch(`/api/calls/${id}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: number }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || "Transfer failed");
    }
  }, [voiceProvider]);

  const sendDTMF = useCallback((digits: string) => {
    if (voiceProvider === "twilio") { twilioEngineRef.current?.sendDigits(digits); return; }
    (activeCallRef.current as any)?.dtmf?.(digits);
  }, [voiceProvider]);

  const joinConference = useCallback(async (conferenceId?: string) => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] joinConference not yet supported on Twilio voice"); return; }
    const id = callControlId();
    if (!id) throw new Error("No call control id");
    conferenceIdRef.current = conferenceId || conferenceIdRef.current;
    await fetch("/api/calls/conference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callControlId: id, command: "join", conferenceId })
    });
  }, []);
  const leaveConference = useCallback(async () => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] leaveConference not yet supported on Twilio voice"); return; }
    const id = callControlId();
    if (!id) throw new Error("No call control id");
    await fetch("/api/calls/conference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callControlId: id, command: "leave" })
    });
  }, [voiceProvider]);
  const addToConference = useCallback(async (phoneNumber: string) => {
    if (voiceProvider === "twilio") { console.warn("[twilio-voice] addToConference not yet supported on Twilio voice"); return; }
    const id = callControlId();
    if (!id) throw new Error("No call control id");
    if (!device) throw new Error("Phone not ready");

    const participantCall = device.newCall({ destinationNumber: phoneNumber, audio: true } as any);

    let participantControlId = (participantCall as any)?.telnyxIDs?.telnyxCallControlId as string | undefined;
    for (let i = 0; !participantControlId && i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      participantControlId = (participantCall as any)?.telnyxIDs?.telnyxCallControlId as string | undefined;
    }
    if (!participantControlId) return;

    await fetch("/api/calls/conference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callControlId: participantControlId,
        command: "join",
        conferenceId: conferenceIdRef.current || undefined
      })
    });
  }, [device, voiceProvider]);

  const openDialer = useCallback(() => {
    setDialerOpen(true);
  }, []);

  // On the Twilio path, expose the engine (cast) as a non-null `device` sentinel
  // once registered, so the consumers' `!device` readiness gate works unchanged.
  const exposedDevice = voiceProvider === "twilio"
    ? (twilioReady ? (twilioEngineRef.current as any) : null)
    : device;

  const value: CallContextValue = { device: exposedDevice, status, activeCall, incomingCall, isMuted, isOnHold, customerLegId, currentContact, setCurrentContact, connectCall, makeCall, answerCall, disconnectCall, toggleMute, unmute, toggleHold, unhold, startRecording, stopRecording, transfer, sendDTMF, joinConference, leaveConference, addToConference, dialerOpen, setDialerOpen, openDialer };
  return <CallContext.Provider value={value}>{children}<CallWidget /><IncomingRingtone /></CallContext.Provider>;
}

export function useCall() { const ctx = useContext(CallContext); if (!ctx) throw new Error("useCall must be used inside CallProvider"); return ctx; }
export const useTelnyx = useCall;
export const useTelnyxDevice = useCall;
export const useAgentTelnyx = useCall;
