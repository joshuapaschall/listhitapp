"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Grid, Mic, MicOff, Pause, Phone, PhoneIncoming, PhoneOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCall } from "@/components/voice/CallProvider";
import { formatPhoneDisplay } from "@/lib/dedup-utils";
import { Dialer } from "@/components/voice/Dialer";

export function CallWidget() {
  const { status, activeCall, incomingCall, currentContact, answerCall, disconnectCall, toggleMute, isMuted, toggleHold, isOnHold, sendDTMF, transfer, dialerOpen, setDialerOpen } = useCall();
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [destination, setDestination] = useState("");
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
    return <div className="fixed bottom-6 right-6 w-80 rounded-2xl border bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><PhoneIncoming className="h-4 w-4" />Incoming call</div>
      <div className="mt-2 text-lg font-semibold">{callName || formatPhoneDisplay(callNumber) || "Unknown"}</div>
      <div className="mt-4 flex gap-2"><Button className="flex-1 bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))] text-white" onClick={answerCall}>Answer</Button><Button className="flex-1" variant="destructive" onClick={disconnectCall}>Decline</Button></div>
    </div>;
  }

  if (activeCall) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return <div className="fixed bottom-6 right-6 z-50" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div className="w-[360px] rounded-2xl bg-slate-900 text-white border border-slate-700 p-4">
        <button className="mx-auto mb-3 block h-1.5 w-14 rounded-full bg-slate-600" aria-label="Drag call widget" onMouseDown={(e)=>{drag.current={dx:e.clientX-position.x,dy:e.clientY-position.y};}} />
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${isOnHold?"bg-amber-400":status==="connecting"?"bg-sky-400":"bg-emerald-400"}`} /><span className="text-xs uppercase tracking-wide">{isOnHold?"On hold":status === "connecting"?"Connecting":"On call"}</span></div><span className="font-mono text-sm">{mm}:{ss}</span></div>
        <div className="mt-3"><div className="text-lg font-semibold">{callName || formatPhoneDisplay(callNumber) || "Active call"}</div><div className="font-mono text-sm text-slate-300">{formatPhoneDisplay(callNumber)}</div></div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="icon" variant="secondary" aria-label="Toggle mute" onClick={toggleMute}>{isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>
          <Button size="icon" variant="secondary" aria-label="Toggle hold" onClick={() => toggleHold()}>{isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
          <Button size="icon" variant="secondary" aria-label="Toggle keypad" onClick={() => setKeypadOpen((v)=>!v)}><Grid className="h-4 w-4" /></Button>
          <Button size="icon" variant="secondary" aria-label="Transfer call" onClick={() => setTransferOpen((v)=>!v)}><ArrowRightLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="destructive" aria-label="End call" onClick={disconnectCall}><PhoneOff className="h-4 w-4" /></Button>
        </div>
        {keypadOpen ? <div className="mt-3 grid grid-cols-3 gap-2">{["1","2","3","4","5","6","7","8","9","*","0","#"].map((d)=><Button key={d} type="button" variant="outline" className="font-mono text-slate-900" onClick={()=>tone(d)}>{d}</Button>)}</div> : null}
        {transferOpen ? <div className="mt-3 flex gap-2"><Input value={destination} className="bg-slate-800 border-slate-700" onChange={(e)=>setDestination(e.target.value)} placeholder="Transfer to number" /><Button onClick={() => transfer(destination)}>Transfer</Button></div> : null}
      </div>
      <Dialer open={dialerOpen} onOpenChange={setDialerOpen} />
    </div>;
  }

  return <>
    <Button className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand-hover))] text-white" size="icon" aria-label="Open dialer" onClick={() => setDialerOpen(true)}><Phone className="h-6 w-6" /></Button>
    <Dialer open={dialerOpen} onOpenChange={setDialerOpen} />
  </>;
}
