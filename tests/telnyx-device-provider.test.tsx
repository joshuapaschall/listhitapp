/** @jest-environment jsdom */
import { render, fireEvent, screen, act } from "@testing-library/react"
vi.mock("@/lib/supabase-browser", () => ({
  __esModule: true,
  supabaseBrowser: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-access" } },
      }),
    },
  }),
}))

vi.useFakeTimers()
// Polyfill WebRTC APIs for tests
// @ts-ignore
global.navigator.mediaDevices = { getUserMedia: vi.fn() }

vi.mock("../components/buyers/buyer-selector", () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button onClick={() => onChange({ id: "b1", phone: "+1222" })}>John Doe</button>
  ),
}))

// cmdk uses ResizeObserver
// @ts-ignore
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock("../components/buyers/use-buyer-suggestions", () => ({
  useBuyerSuggestions: () => ({
    results: [{ id: "b1", phone: "+1222", full_name: "John Doe" }],
    loading: false,
  }),
}))

let lastDevice: any
let TelnyxDeviceProvider: typeof import("../components/voice/TelnyxDeviceProvider").TelnyxDeviceProvider
let useTelnyxDevice: typeof import("../components/voice/TelnyxDeviceProvider").useTelnyxDevice
let DialPad: typeof import("../components/voice/DialPad").default
let TelnyxRTC: vi.Mock
let SwEvent: any
let toast: typeof import("sonner").toast

const fetchMock = vi.fn()
// @ts-ignore
global.fetch = fetchMock

function TestComp() {
  const { connectCall } = useTelnyxDevice()
  return <button onClick={() => connectCall("+1222")}>get</button>
}

describe("TelnyxDeviceProvider", () => {
  beforeAll(async () => {
    await vi.mock("sonner", () => ({
      __esModule: true,
      toast: {
        info: vi.fn(() => "toast-id"),
        dismiss: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
      },
    }))

    await vi.mock("@telnyx/webrtc", () => ({
      __esModule: true,
      TelnyxRTC: vi.fn().mockImplementation(() => {
        lastDevice = {
          on: vi.fn(),
          off: vi.fn(),
          connect: vi.fn(),
          enableMicrophone: vi.fn().mockResolvedValue(undefined),
          newCall: vi.fn(() => ({
            invite: vi.fn(),
            on: vi.fn(),
            disconnect: vi.fn(),
            toggleAudioMute: vi.fn(),
            toggleHold: vi.fn(),
            hangup: vi.fn(),
            telnyxIDs: { telnyxCallControlId: "C1" },
            parameters: { To: "+1222" },
            dtmf: vi.fn(),
          })),
        }
        return lastDevice
      }),
      Call: class {},
      SwEvent: {
        Ready: "telnyx.ready",
        Error: "telnyx.error",
        Notification: "telnyx.notification",
      },
    }))

    const telnyxModule = await import("@telnyx/webrtc")
    TelnyxRTC = telnyxModule.TelnyxRTC as unknown as vi.Mock
    SwEvent = telnyxModule.SwEvent

    const providerModule = await import("../components/voice/TelnyxDeviceProvider")
    TelnyxDeviceProvider = providerModule.TelnyxDeviceProvider
    useTelnyxDevice = providerModule.useTelnyxDevice

    DialPad = (await import("../components/voice/DialPad")).default
    toast = (await import("sonner")).toast
  })

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/telnyx/token") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "abc", sip_username: "sip_1001", sip_password: "secret" }),
        })
      }
      if (url === "/api/voice-numbers") {
        return Promise.resolve({ ok: true, json: async () => ({ numbers: ["+1999"] }) })
      }
      if (url === "/api/calls/outbound") {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      if (url.includes("/api/calls/record")) {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
    ;(TelnyxRTC as vi.Mock).mockClear()
    ;(toast.info as vi.Mock).mockClear()
    ;(toast.dismiss as vi.Mock).mockClear()
    localStorage.clear()
  })

  test("connects with token", async () => {
    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/telnyx/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-access" }),
      }),
    )
    expect((TelnyxRTC as vi.Mock).mock.calls[0][0]).toMatchObject({ debug: true })
  })

test.skip("dial uses TelnyxRTC newCall", async () => {
    render(
      <TelnyxDeviceProvider>
        <DialPad />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    const ready = (lastDevice.on as vi.Mock).mock.calls.find(c => c[0] === SwEvent.Ready)?.[1]
    if (ready) await act(async () => { ready(); await Promise.resolve() })
    fireEvent.click(screen.getByText("John Doe"))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /call/i }))
    })
    await act(async () => {})
    expect(lastDevice.newCall).toHaveBeenCalled()
  })

  test("listens for notification events", async () => {
    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    const events = (lastDevice.on as vi.Mock).mock.calls.map(c => c[0])
    expect(events).toContain(SwEvent.Notification)
  })

  test("handles token error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "bad" }) })
    function Status() {
      const { status } = useTelnyxDevice()
      return <div>{status}</div>
    }
    render(
      <TelnyxDeviceProvider>
        <Status />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    expect(screen.getByText("error")).toBeTruthy()
    expect(TelnyxRTC).not.toHaveBeenCalled()
  })

  test("shows unlock toast and stores flag", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})

    expect(toast.info).toHaveBeenCalled()
    expect(toast.dismiss).not.toHaveBeenCalled()

    fireEvent.click(window)
    await act(async () => {})

    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    expect(toast.dismiss).toHaveBeenCalledWith("toast-id")
    expect(localStorage.getItem("audioUnlocked")).toBe("true")
  })

  test("plays ringtone on incoming call", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))

    localStorage.setItem("audioUnlocked", "true")

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )

    await act(async () => {})
    const handler = (lastDevice.on as vi.Mock).mock.calls.find(c => c[0] === SwEvent.Notification)?.[1]
    const call = { state: "ringing", direction: "inbound" }
    if (handler) {
      await act(async () => {
        handler({ type: "callUpdate", call })
        expect(play).toHaveBeenCalledTimes(1)
      })
    }

    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
  })

  test("dispatches telnyxCallConnected on active call", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))
    // Mock play on created audio element
    // @ts-ignore
    HTMLMediaElement.prototype.play = play

    localStorage.setItem("audioUnlocked", "true")

    const listener = vi.fn()
    window.addEventListener(
      "telnyxCallConnected",
      listener as EventListener,
    )

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )

    await act(async () => {})
    const ready = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Ready,
    )?.[1]
    if (ready) {
      await act(async () => {
        ready()
      })
      await act(async () => {})
    }
    const handler = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Notification,
    )?.[1]
    const call = {
      state: "active",
      direction: "outbound",
      remoteCallerNumber: "+1555",
      destinationNumber: "+1666",
    }
    if (handler) {
      await act(async () => {
        handler({ type: "callUpdate", call })
      })
    }

    expect(listener).toHaveBeenCalledTimes(1)
    const evt = listener.mock.calls[0][0] as CustomEvent
    expect(evt.detail.call).toBe(call)
    expect(evt.detail.from).toBe("+1555")
    expect(evt.detail.to).toBe("+1666")

    window.removeEventListener(
      "telnyxCallConnected",
      listener as EventListener,
    )
  })

  test("creates call record when callRecordPending flag is set", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))
    // @ts-ignore
    HTMLMediaElement.prototype.play = play

    localStorage.setItem("audioUnlocked", "true")

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )

    await act(async () => {})
    const ready = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Ready,
    )?.[1]
    if (ready) {
      await act(async () => {
        ready()
      })
    }
    const handler = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Notification,
    )?.[1]
    const call = {
      state: "active",
      direction: "outbound",
      destinationNumber: "+1777",
      callerNumber: "+1888",
      callRecordPending: true,
    }
    if (handler) {
      await act(async () => {
        handler({ type: "callUpdate", call })
      })
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calls/record",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          to: "+1777",
          callerId: "+1888",
          direction: "outbound",
        }),
      }),
    )
  })

  test("disconnectCall can be called multiple times", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))

    localStorage.setItem("audioUnlocked", "true")

    function Btn() {
      const { disconnectCall } = useTelnyxDevice()
      return <button onClick={disconnectCall}>end</button>
    }

    render(
      <TelnyxDeviceProvider>
        <Btn />
      </TelnyxDeviceProvider>,
    )

    await act(async () => {})
    const ready = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Ready,
    )?.[1]
    if (ready) {
      await act(async () => {
        ready()
      })
    }
    const handler = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Notification,
    )?.[1]
    const call = {
      state: "active",
      direction: "outbound",
      hangup: vi.fn(),
      parameters: {},
    }
    if (handler) {
      await act(async () => {
        handler({ type: "callUpdate", call })
      })
    }

    fireEvent.click(screen.getByText("end"))
    fireEvent.click(screen.getByText("end"))

    expect(call.hangup).toHaveBeenCalledTimes(1)
  })

  test("repeated calls remove old icecandidate listener", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    // @ts-ignore
    global.Audio = vi.fn().mockImplementation(() => ({
      play,
      pause,
      load: vi.fn(),
      currentTime: 0,
      loop: false,
    }))

    localStorage.setItem("audioUnlocked", "true")

    const pc1 = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const pc2 = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const call1 = {
      state: "new",
      direction: "outbound",
      hangup: vi.fn(),
      invite: vi.fn(),
      peer: { instance: pc1 },
      parameters: {},
    }
    const call2 = {
      state: "new",
      direction: "outbound",
      hangup: vi.fn(),
      invite: vi.fn(),
      peer: { instance: pc2 },
      parameters: {},
    }

    function Btn() {
      const { connectCall, disconnectCall } = useTelnyxDevice()
      return (
        <>
          <button onClick={() => connectCall("+1999")}>call</button>
          <button onClick={disconnectCall}>end</button>
        </>
      )
    }

    render(
      <TelnyxDeviceProvider>
        <Btn />
      </TelnyxDeviceProvider>,
    )

    await act(async () => {})
    const ready = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Ready,
    )?.[1]
    if (ready) {
      await act(async () => {
        ready()
      })
    }

    ;(lastDevice.newCall as vi.Mock).mockReturnValueOnce(call1).mockReturnValueOnce(call2)

    fireEvent.click(screen.getByText("call"))
    await act(async () => {})
    expect(lastDevice.newCall).toHaveBeenCalled()
    const firstHandler = pc1.addEventListener.mock.calls[0]?.[1]
    const notify = (lastDevice.on as vi.Mock).mock.calls.find(
      c => c[0] === SwEvent.Notification,
    )?.[1]
    if (notify) {
      await act(async () => {
        notify({ type: "callUpdate", call: { state: "active", direction: "outbound", parameters: {} } })
      })
    }
    fireEvent.click(screen.getByText("end"))
    expect(pc1.removeEventListener).toHaveBeenCalledWith(
      "icecandidate",
      firstHandler,
    )

    fireEvent.click(screen.getByText("call"))
    await act(async () => {})
    const secondHandler = pc2.addEventListener.mock.calls[0]?.[1]
    expect(secondHandler).not.toBe(firstHandler)
    expect(pc1.removeEventListener).toHaveBeenCalledTimes(1)
  })

  test("patches _onIceSdp to validate input", async () => {
    const CallClass = function () {}
    ;(TelnyxRTC as any).Call = CallClass
    const proto = CallClass.prototype
    const orig = (proto._onIceSdp = vi.fn())

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    await act(async () => {})

    expect(proto._onIceSdp).not.toBe(orig)

    const dispatch = vi.spyOn(window, "dispatchEvent")
    ;(proto._onIceSdp as any)(null)
    expect(dispatch).toHaveBeenCalledWith(expect.any(CustomEvent))
    expect(orig).not.toHaveBeenCalled()

    const desc = { sdp: "s", type: "offer" }
    ;(proto._onIceSdp as any)(desc)
    expect(orig).toHaveBeenCalledWith(desc)
  })

  test("patches _onIce to validate input", async () => {
    const CallClass = function () {}
    ;(TelnyxRTC as any).Call = CallClass
    const proto = CallClass.prototype
    const orig = (proto._onIce = vi.fn())
    proto._onIceSdp = vi.fn()

    render(
      <TelnyxDeviceProvider>
        <div />
      </TelnyxDeviceProvider>,
    )
    await act(async () => {})
    await act(async () => {})

    expect(proto._onIce).not.toBe(orig)

    const dispatch = vi.spyOn(window, "dispatchEvent")
    ;(proto._onIce as any)(null)
    expect(dispatch).toHaveBeenCalledWith(expect.any(CustomEvent))
    expect(orig).not.toHaveBeenCalled()

    const evt = { localDescription: { sdp: "s", type: "offer" } }
    ;(proto._onIce as any)(evt)
    expect(orig).toHaveBeenCalledWith(evt)
  })
})
