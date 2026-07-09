"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Grid, Mic, MicOff, Pause, Phone, PhoneIncoming, PhoneOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCall } from "@/components/voice/CallProvider";
import { formatPhoneDisplay } from "@/lib/dedup-utils";
import { Dialer } from "@/components/voice/Dialer";

// Raw call green / hang-up red — allowed on the round call/answer/end controls.
const CALL_GREEN = "#1DB954";
const HANGUP_RED = "#E24B4A";

const initialsOf = (s: string) =>
  s.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

export function CallWidget() {
  const { status, activeCall, incomingCall, currentContact, answerCall, disconnectCall, toggleMute, isMuted, toggleHold, isOnHold, sendDTMF, transfer, voiceProvider, warmTransferState, startWarmTransfer, completeWarmTransfer, cancelWarmTransfer, dialerOpen, setDialerOpen } = useCall();
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [warmError, setWarmError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{dx:number;dy:number}|null>(null);

  useEffect(() => {
    if (!activeCall) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPosition({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const callNumber = useMemo(() => currentContact?.number || (activeCall as any)?.parameters?.To || (activeCall as any)?.parameters?.From || (incomingCall as any)?.parameters?.From || "", [currentContact, activeCall, incomingCall]);
  const callName = currentContact?.name || "";
  const avatarSeed = callName || formatPhoneDisplay(callNumber) || "?";

  const tone = (digit: string) => {
    sendDTMF(digit);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  };

  if (incomingCall && !activeCall) {
    return <div className="fixed bottom-6 right-6 z-50 w-80">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CALL_GREEN }} />
          <PhoneIncoming className="h-3.5 w-3.5" />
          Incoming call
        </div>
        <div className="mt-4 flex flex-col items-center">
          <Avatar className="h-16 w-16 ring-2 ring-brand">
            <AvatarFallback className="text-lg">{initialsOf(avatarSeed)}</AvatarFallback>
          </Avatar>
          <div className="mt-3 text-lg font-semibold text-foreground">{callName || formatPhoneDisplay(callNumber) || "Unknown"}</div>
          <div className="font-mono text-sm text-muted-foreground">{formatPhoneDisplay(callNumber)}</div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-1.5">
            <button type="button" onClick={disconnectCall} aria-label="Decline" className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: HANGUP_RED }}>
              <PhoneOff className="h-6 w-6" />
            </button>
            <span className="text-xs text-muted-foreground">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button type="button" onClick={answerCall} aria-label="Answer" className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: CALL_GREEN }}>
              <Phone className="h-6 w-6" />
            </button>
            <span className="text-xs text-muted-foreground">Answer</span>
          </div>
        </div>
      </div>
    </div>;
  }

  if (activeCall) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    const lineFrom = (activeCall as any)?.parameters?.From as string | undefined;
    const stateDot = isOnHold ? "bg-amber-500" : status === "connecting" ? "bg-sky-500" : "";
    const stateLabel = isOnHold ? "On hold" : status === "connecting" ? "Connecting" : "On call";
    return <div className="fixed bottom-6 right-6 z-50" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div className="w-[360px] rounded-2xl border border-border bg-card p-5 shadow-lg">
        <button className="mx-auto mb-4 block h-1.5 w-14 rounded-full bg-muted" aria-label="Drag call widget" onMouseDown={(e)=>{drag.current={dx:e.clientX-position.x,dy:e.clientY-position.y};}} />
        <div className="flex flex-col items-center">
          <Avatar className="h-16 w-16 ring-2 ring-brand">
            <AvatarFallback className="text-lg">{initialsOf(avatarSeed)}</AvatarFallback>
          </Avatar>
          <div className="mt-3 text-lg font-semibold text-foreground">{callName || formatPhoneDisplay(callNumber) || "Active call"}</div>
          <div className="font-mono text-sm text-muted-foreground">{formatPhoneDisplay(callNumber)}</div>
          {lineFrom && lineFrom !== callNumber ? (
            <div className="text-xs text-muted-foreground">from {formatPhoneDisplay(lineFrom)}</div>
          ) : null}
          <div className="mt-2 flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${stateDot}`} style={stateDot ? undefined : { backgroundColor: CALL_GREEN }} />
            <span className="text-muted-foreground">{stateLabel}</span>
            <span className="font-mono text-foreground">{mm}:{ss}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" aria-label="Toggle mute" onClick={toggleMute} className={`flex h-11 w-11 items-center justify-center rounded-full border ${isMuted ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-muted"}`}>
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Toggle hold" onClick={() => toggleHold()} className={`flex h-11 w-11 items-center justify-center rounded-full border ${isOnHold ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-muted"}`}>
            {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button type="button" aria-label="Toggle keypad" onClick={() => setKeypadOpen((v)=>!v)} className={`flex h-11 w-11 items-center justify-center rounded-full border ${keypadOpen ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-muted"}`}>
            <Grid className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Transfer call" onClick={() => setTransferOpen((v)=>!v)} className={`flex h-11 w-11 items-center justify-center rounded-full border ${transferOpen ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground hover:bg-muted"}`}>
            <ArrowRightLeft className="h-5 w-5" />
          </button>
        </div>

        {keypadOpen ? <div className="mt-4 grid grid-cols-3 gap-2">{["1","2","3","4","5","6","7","8","9","*","0","#"].map((d)=><Button key={d} type="button" variant="outline" className="h-10 font-mono" onClick={()=>tone(d)}>{d}</Button>)}</div> : null}
        {transferOpen ? (
          voiceProvider === "twilio" ? (
            warmTransferState === "announcing" ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Connected to {destination}. Caller is on hold.</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={async () => { await completeWarmTransfer(); setTransferOpen(false); }}>
                    Complete transfer
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={async () => { await cancelWarmTransfer(); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input value={destination} onChange={(e)=>{ setDestination(e.target.value); setWarmError(null); }} placeholder="Transfer to number" />
                  <Button disabled={warmTransferState === "dialing" || !destination} onClick={async () => { setWarmError(null); try { await startWarmTransfer(destination); } catch (err) { setWarmError(err instanceof Error ? err.message : "Could not reach that number"); } }}>
                    {warmTransferState === "dialing" ? "Dialing…" : "Call"}
                  </Button>
                </div>
                {warmTransferState === "dialing" ? <p className="text-sm text-muted-foreground">Caller is on hold. Ringing {destination}…</p> : null}
                {warmError ? <p className="text-sm text-destructive">{warmError}</p> : null}
              </div>
            )
          ) : (
            <div className="mt-4 flex gap-2">
              <Input value={destination} onChange={(e)=>setDestination(e.target.value)} placeholder="Transfer to number" />
              <Button onClick={() => transfer(destination)}>Transfer</Button>
            </div>
          )
        ) : null}

        <Button type="button" className="mt-4 w-full text-white hover:opacity-90" style={{ backgroundColor: HANGUP_RED }} onClick={disconnectCall}>
          <PhoneOff className="mr-2 h-4 w-4" />End call
        </Button>
      </div>
      <Dialer open={dialerOpen} onOpenChange={setDialerOpen} />
    </div>;
  }

  // Launcher FAB removed — the dialer is opened from the header (openDialer).
  // Keep the Dialer mounted here so that header button still has something to open.
  return <Dialer open={dialerOpen} onOpenChange={setDialerOpen} />;
}
