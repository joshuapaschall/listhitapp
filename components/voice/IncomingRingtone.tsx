"use client";

import { useEffect, useRef } from "react";
import { useCall } from "@/components/voice/CallProvider";

export function IncomingRingtone() {
  const { incomingCall, activeCall } = useCall();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/incoming-call.mp3");
    audioRef.current.loop = true;
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const shouldPlay = Boolean(incomingCall && !activeCall);
    if (!audioRef.current) return;
    if (shouldPlay) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => undefined);
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [incomingCall, activeCall]);

  return null;
}
