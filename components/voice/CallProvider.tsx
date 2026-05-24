"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CallWidget } from "@/components/voice/CallWidget";
import { IncomingRingtone } from "@/components/voice/IncomingRingtone";
import { Call, TelnyxRTC } from "@telnyx/webrtc";
import { supabaseBrowser } from "@/lib/supabase-browser";

type CallStatus = "idle" | "connecting" | "on-call" | "error";

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
  const activeCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const conferenceIdRef = useRef<string | null>(null);
  const sipUsernameRef = useRef<string | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);


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

  useEffect(() => {
    let created: TelnyxRTC | null = null;
    let mounted = true;

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
          if (n.type === "call.received" || (n.type === "callUpdate" && state === "ringing" && call.direction !== "outbound")) {
            setIncomingCall(call);
            setStatus("connecting");
            return;
          }
          if (n.type === "callUpdate") {
            const controlId = (call as any)?.telnyxIDs?.telnyxCallControlId || null;
            if (controlId) setCustomerLegId(controlId);
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
  }, [reportPresence]);

  const dialInternal = useCallback(async (destination: string, callerIdNumber?: string) => {
    if (!device) throw new Error("Phone not ready");
    const fallbackFrom =
      process.env.NEXT_PUBLIC_DEFAULT_OUTBOUND_DID ||
      process.env.NEXT_PUBLIC_FROM_NUMBER ||
      undefined;
    const callerNumber = callerIdNumber || fallbackFrom;
    const call = device.newCall({ destinationNumber: destination, callerNumber, audio: true } as any);
    setActiveCall(call);
    setStatus("connecting");
  }, [device]);

  const connectCall = useCallback(async (number: string, callerIdNumber?: string) => {
    await dialInternal(number, callerIdNumber);
  }, [dialInternal]);

  const makeCall = useCallback(async (destination: string, buyerId?: string, fromNumber?: string) => {
    await dialInternal(destination, fromNumber);
    return { ok: true, buyerId: buyerId || null };
  }, [dialInternal]);

  const answerCall = useCallback(() => {
    const call = incomingCall || activeCallRef.current;
    (call as any)?.answer?.();
    if (call) setActiveCall(call);
  }, [incomingCall]);

  const disconnectCall = useCallback(() => {
    const call = activeCallRef.current || incomingCallRef.current;
    (call as any)?.hangup?.();
    setActiveCall(null);
    setIncomingCall(null);
    setStatus("idle");
    setCurrentContact(null);
  }, []);

  const toggleMute = useCallback(() => {
    const call = activeCallRef.current as any;
    if (!call) return;
    if (call.isAudioMuted) { call.unmuteAudio?.(); setIsMuted(false); } else { call.muteAudio?.(); setIsMuted(true); }
  }, []);
  const unmute = useCallback(() => { (activeCallRef.current as any)?.unmuteAudio?.(); setIsMuted(false); }, []);

  const callControlId = () => (activeCallRef.current as any)?.telnyxIDs?.telnyxCallControlId;

  const toggleHold = useCallback(async () => {
    const id = callControlId();
    if (!id) throw new Error("No call control id");
    const action = isOnHold ? "unhold" : "hold";
    await fetch(`/api/calls/${id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setIsOnHold(!isOnHold);
  }, [isOnHold]);

  const unhold = useCallback(async () => {
    const id = callControlId();
    if (!id) return;
    await fetch(`/api/calls/${id}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unhold" }) });
    setIsOnHold(false);
  }, []);

  const startRecording = useCallback(async () => {
    const id = callControlId();
    if (!id) return;
    await fetch(`/api/calls/${id}/record_start`, { method: "POST" });
  }, []);

  const stopRecording = useCallback(async () => {
    const id = callControlId();
    if (!id) return;
    await fetch(`/api/calls/${id}/record_stop`, { method: "POST" });
  }, []);

  const transfer = useCallback(async (number: string) => {
    const call = activeCallRef.current as any;
    try { await call?.transfer?.(number); return; } catch {}
    const id = call?.telnyxIDs?.telnyxCallControlId;
    if (!id) throw new Error("No call control id");
    await fetch(`/api/calls/${id}/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: number }) });
  }, []);

  const sendDTMF = useCallback((digits: string) => { (activeCallRef.current as any)?.dtmf?.(digits); }, []);

  const joinConference = useCallback(async (conferenceId?: string) => {
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
    const id = callControlId();
    if (!id) throw new Error("No call control id");
    await fetch("/api/calls/conference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callControlId: id, command: "leave" })
    });
  }, []);
  const addToConference = useCallback(async (phoneNumber: string) => {
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
  }, [device]);

  const openDialer = useCallback(() => {
    setDialerOpen(true);
  }, []);

  const value: CallContextValue = { device, status, activeCall, incomingCall, isMuted, isOnHold, customerLegId, currentContact, setCurrentContact, connectCall, makeCall, answerCall, disconnectCall, toggleMute, unmute, toggleHold, unhold, startRecording, stopRecording, transfer, sendDTMF, joinConference, leaveConference, addToConference, dialerOpen, setDialerOpen, openDialer };
  return <CallContext.Provider value={value}>{children}<CallWidget /><IncomingRingtone /></CallContext.Provider>;
}

export function useCall() { const ctx = useContext(CallContext); if (!ctx) throw new Error("useCall must be used inside CallProvider"); return ctx; }
export const useTelnyx = useCall;
export const useTelnyxDevice = useCall;
export const useAgentTelnyx = useCall;
