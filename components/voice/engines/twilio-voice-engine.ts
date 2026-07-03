"use client";

// Encapsulates the Twilio Voice JS SDK Device for OUTBOUND (direct-dial) calling.
// The browser is the near leg; the TwiML App webhook applies the org's caller ID
// and dials the prospect. This module NEVER imports Telnyx — CallProvider picks
// the engine per org. Inbound/recording/transfer/conference are V2/V3.

import { Device, type Call } from "@twilio/voice-sdk";

// MUST match CallProvider's CallStatus union.
export type TwilioEngineStatus = "idle" | "connecting" | "on-call" | "error";

export interface TwilioVoiceEngineCallbacks {
  onStatus: (s: TwilioEngineStatus) => void;
  onReady: (ready: boolean) => void;
  onActiveCall: (call: Call | null) => void;
  onMuted: (muted: boolean) => void;
  onIncomingCall: (call: Call | null) => void;
}

const LOG = "[twilio-voice]";

export class TwilioVoiceEngine {
  private device: Device | null = null;
  private call: Call | null = null;
  private incoming: Call | null = null;
  private destroyed = false;

  constructor(private readonly cb: TwilioVoiceEngineCallbacks) {}

  private async fetchToken(): Promise<string> {
    const res = await fetch("/api/twilio/voice-token", { method: "POST", cache: "no-store" });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.token) {
      throw new Error(json?.error || "Failed to fetch Twilio voice token");
    }
    return json.token as string;
  }

  // Mint a token, build the Device, register signaling. Reports readiness via the
  // "registered" event. Never throws into React — failures surface as onStatus("error").
  async init(): Promise<void> {
    try {
      const token = await this.fetchToken();
      if (this.destroyed) return;

      const device = new Device(token);
      this.device = device;

      device.on("registered", () => {
        if (this.destroyed) return;
        this.cb.onReady(true);
        this.cb.onStatus("idle");
      });

      device.on("error", (err: any) => {
        console.warn(LOG, "device error", err?.message || err);
        if (this.destroyed) return;
        this.cb.onStatus("error");
        this.cb.onReady(false);
      });

      device.on("tokenWillExpire", async () => {
        try {
          const next = await this.fetchToken();
          this.device?.updateToken(next);
        } catch (err) {
          console.warn(LOG, "token refresh failed", err);
        }
      });

      // Inbound (V2): the voice webhook dials this browser at its <Client> identity.
      device.on("incoming", (call: Call) => {
        if (this.destroyed) return;
        this.incoming = call;

        // Caller hung up / another browser answered before we did, or the call ends.
        const clear = () => {
          if (this.incoming === call) {
            this.incoming = null;
            this.cb.onIncomingCall(null);
          }
          if (this.call === call) {
            this.call = null;
            this.cb.onActiveCall(null);
            this.cb.onMuted(false);
            this.cb.onStatus("idle");
          }
        };
        call.on("cancel", clear);
        call.on("disconnect", clear);
        call.on("reject", clear);
        call.on("accept", () => {
          if (this.destroyed) return;
          this.call = call;
          this.incoming = null;
          this.cb.onIncomingCall(null);
          this.cb.onActiveCall(call);
          this.cb.onStatus("on-call");
        });
        call.on("error", (err: any) => {
          console.warn(LOG, "incoming call error", err?.message || err);
          if (!this.destroyed) this.cb.onStatus("error");
        });

        this.cb.onIncomingCall(call);
      });

      await device.register();
    } catch (err) {
      console.warn(LOG, "init failed", err);
      if (this.destroyed) return;
      this.cb.onStatus("error");
      this.cb.onReady(false);
    }
  }

  // Client passes ONLY the destination — caller ID is server-enforced by the TwiML
  // webhook. Status moves connecting → on-call on the call's "accept" event.
  async makeCall(destination: string): Promise<void> {
    if (!this.device) {
      console.warn(LOG, "makeCall before device ready");
      this.cb.onStatus("error");
      return;
    }
    try {
      this.cb.onStatus("connecting");
      const call = await this.device.connect({ params: { To: destination } });
      this.call = call;
      this.cb.onActiveCall(call);

      call.on("accept", () => {
        if (!this.destroyed) this.cb.onStatus("on-call");
      });
      const cleanup = () => {
        if (this.destroyed) return;
        this.call = null;
        this.cb.onActiveCall(null);
        this.cb.onMuted(false);
        this.cb.onStatus("idle");
      };
      call.on("disconnect", cleanup);
      call.on("cancel", cleanup);
      call.on("reject", cleanup);
      call.on("error", (err: any) => {
        console.warn(LOG, "call error", err?.message || err);
        if (!this.destroyed) this.cb.onStatus("error");
      });
    } catch (err) {
      console.warn(LOG, "makeCall failed", err);
      this.call = null;
      this.cb.onActiveCall(null);
      this.cb.onStatus("error");
    }
  }

  // Answer a ringing inbound call. The "accept" wiring set in init() promotes it to
  // the active call and moves status to on-call.
  acceptIncoming(): void {
    try {
      this.incoming?.accept();
    } catch (err) {
      console.warn(LOG, "acceptIncoming failed", err);
    }
  }

  rejectIncoming(): void {
    const call = this.incoming;
    this.incoming = null;
    try {
      call?.reject();
    } catch (err) {
      console.warn(LOG, "rejectIncoming failed", err);
    }
    this.cb.onIncomingCall(null);
  }

  disconnect(): void {
    try {
      this.call?.disconnect();
    } catch (err) {
      console.warn(LOG, "disconnect failed", err);
    }
  }

  setMuted(muted: boolean): void {
    try {
      this.call?.mute(muted);
      this.cb.onMuted(muted);
    } catch (err) {
      console.warn(LOG, "mute failed", err);
    }
  }

  // Interim hold = mute the near leg WITHOUT touching the mute indicator. A real
  // hold (caller hears hold music) needs server TwiML and lands in V3.
  setHold(hold: boolean): void {
    try {
      this.call?.mute(hold);
    } catch (err) {
      console.warn(LOG, "hold(mute) failed", err);
    }
  }

  sendDigits(digits: string): void {
    try {
      this.call?.sendDigits(digits);
    } catch (err) {
      console.warn(LOG, "sendDigits failed", err);
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    try {
      this.incoming?.reject();
    } catch {}
    try {
      this.call?.disconnect();
    } catch {}
    try {
      this.device?.destroy();
    } catch {}
    this.incoming = null;
    this.call = null;
    this.device = null;
  }
}
