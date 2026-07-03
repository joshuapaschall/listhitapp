// Unit tests for the Twilio voice engine. @twilio/voice-sdk and fetch are mocked;
// no real network or SDK.

const h = vi.hoisted(() => {
  const deviceListeners: Record<string, (...args: any[]) => void> = {};
  const callListeners: Record<string, (...args: any[]) => void> = {};

  const call = {
    on: vi.fn((ev: string, fn: any) => {
      callListeners[ev] = fn;
    }),
    disconnect: vi.fn(),
    mute: vi.fn(),
    isMuted: vi.fn(() => false),
    sendDigits: vi.fn(),
    parameters: { To: "+12223334444" },
  };

  const device = {
    on: vi.fn((ev: string, fn: any) => {
      deviceListeners[ev] = fn;
    }),
    register: vi.fn(async () => {}),
    connect: vi.fn(async () => call),
    updateToken: vi.fn(),
    destroy: vi.fn(),
  };

  const DeviceCtor = vi.fn(() => device);

  return { deviceListeners, callListeners, call, device, DeviceCtor };
});

vi.mock("@twilio/voice-sdk", () => ({ Device: h.DeviceCtor }));

import { TwilioVoiceEngine } from "@/components/voice/engines/twilio-voice-engine";

const fetchMock = vi.fn();
// @ts-ignore
global.fetch = fetchMock;

function makeCallbacks() {
  return {
    onStatus: vi.fn(),
    onReady: vi.fn(),
    onActiveCall: vi.fn(),
    onMuted: vi.fn(),
  };
}

describe("TwilioVoiceEngine", () => {
  beforeEach(() => {
    h.DeviceCtor.mockClear();
    h.device.register.mockClear();
    h.device.connect.mockClear();
    h.device.updateToken.mockClear();
    h.device.destroy.mockClear();
    h.call.disconnect.mockClear();
    h.call.mute.mockClear();
    h.call.sendDigits.mockClear();
    Object.keys(h.deviceListeners).forEach((k) => delete h.deviceListeners[k]);
    Object.keys(h.callListeners).forEach((k) => delete h.callListeners[k]);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: "JWT_TOKEN", identity: "id", ttl: 3600 }) });
  });

  test("init fetches a token, builds Device, registers, reports ready on 'registered'", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();

    expect(fetchMock).toHaveBeenCalledWith("/api/twilio/voice-token", expect.objectContaining({ method: "POST" }));
    expect(h.DeviceCtor).toHaveBeenCalledWith("JWT_TOKEN");
    expect(h.device.register).toHaveBeenCalled();

    // Fire the SDK "registered" event.
    h.deviceListeners["registered"]?.();
    expect(cb.onReady).toHaveBeenCalledWith(true);
    expect(cb.onStatus).toHaveBeenCalledWith("idle");
  });

  test("device 'error' reports error + not ready", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    h.deviceListeners["error"]?.({ message: "boom" });
    expect(cb.onStatus).toHaveBeenCalledWith("error");
    expect(cb.onReady).toHaveBeenCalledWith(false);
  });

  test("makeCall connects with { To } and moves connecting → on-call on 'accept'", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();

    await engine.makeCall("+12223334444");
    expect(cb.onStatus).toHaveBeenCalledWith("connecting");
    expect(h.device.connect).toHaveBeenCalledWith({ params: { To: "+12223334444" } });
    expect(cb.onActiveCall).toHaveBeenCalledWith(h.call);

    h.callListeners["accept"]?.();
    expect(cb.onStatus).toHaveBeenCalledWith("on-call");
  });

  test("call 'disconnect' cleans up (idle, no active call, unmuted)", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.makeCall("+12223334444");

    h.callListeners["disconnect"]?.();
    expect(cb.onActiveCall).toHaveBeenLastCalledWith(null);
    expect(cb.onMuted).toHaveBeenCalledWith(false);
    expect(cb.onStatus).toHaveBeenLastCalledWith("idle");
  });

  test("disconnect() ends the current call", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.makeCall("+12223334444");
    engine.disconnect();
    expect(h.call.disconnect).toHaveBeenCalled();
  });

  test("setMuted mutes the call and reports muted", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.makeCall("+12223334444");
    engine.setMuted(true);
    expect(h.call.mute).toHaveBeenCalledWith(true);
    expect(cb.onMuted).toHaveBeenCalledWith(true);
  });

  test("setHold mutes without reporting muted (interim hold)", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.makeCall("+12223334444");
    cb.onMuted.mockClear();
    engine.setHold(true);
    expect(h.call.mute).toHaveBeenCalledWith(true);
    expect(cb.onMuted).not.toHaveBeenCalled();
  });

  test("sendDigits forwards to the call", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.makeCall("+12223334444");
    engine.sendDigits("123");
    expect(h.call.sendDigits).toHaveBeenCalledWith("123");
  });

  test("tokenWillExpire re-fetches and calls updateToken", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: "JWT_2" }) });
    await h.deviceListeners["tokenWillExpire"]?.();
    expect(h.device.updateToken).toHaveBeenCalledWith("JWT_2");
  });

  test("destroy tears down the device", async () => {
    const cb = makeCallbacks();
    const engine = new TwilioVoiceEngine(cb);
    await engine.init();
    await engine.destroy();
    expect(h.device.destroy).toHaveBeenCalled();
  });
});
