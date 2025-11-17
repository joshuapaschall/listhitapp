/** @jest-environment jsdom */
import { render, fireEvent, screen, act } from "@testing-library/react"
import { TelnyxDeviceProvider } from "../components/voice/TelnyxDeviceProvider"
import DialPad from "../components/voice/DialPad"

jest.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "test-access" } },
      }),
    },
  }),
}))

jest.useFakeTimers()
// Polyfill WebRTC APIs for tests
// @ts-ignore
global.navigator.mediaDevices = { getUserMedia: jest.fn() }

jest.mock("../components/buyers/buyer-selector", () => ({
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

let lastDevice: any
jest.mock("@telnyx/webrtc", () => {
  return {
    TelnyxRTC: jest.fn().mockImplementation(() => {
      lastDevice = {
        on: jest.fn(),
        off: jest.fn(),
        connect: jest.fn(),
        newCall: jest.fn(() => ({
          invite: jest.fn(),
          on: jest.fn(),
          disconnect: jest.fn(),
          toggleAudioMute: jest.fn(),
          toggleHold: jest.fn(),
          hangup: jest.fn(),
          dtmf: jest.fn(),
          telnyxIDs: { telnyxCallControlId: "C1" },
          parameters: { To: "+1222" },
        })),
      }
      return lastDevice
    }),
    Call: class {},
    SwEvent: { Notification: "n" },
  }
})

jest.mock("../components/buyers/use-buyer-suggestions", () => ({
  useBuyerSuggestions: () => ({
    results: [{ id: "b1", phone: "+1222", full_name: "John Doe" }],
    loading: false,
  }),
}))

const fetchMock = jest.fn()
// @ts-ignore
global.fetch = fetchMock

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/telnyx/token") {
      return Promise.resolve({ ok: true, json: async () => ({ token: "abc" }) })
    }
    if (url === "/api/voice-numbers") {
      return Promise.resolve({ ok: true, json: async () => ({ numbers: ["+1999"] }) })
    }
    if (url.includes("record")) {
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }
    if (url === "/api/calls/outbound") {
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})

test.skip("modal controls control call", async () => {
  render(
    <TelnyxDeviceProvider>
      <DialPad />
    </TelnyxDeviceProvider>,
  )
  await act(async () => {})
  const ready = (lastDevice.on as jest.Mock).mock.calls.find(c => c[0] === 'telnyx.ready')?.[1]
  if (ready) await act(async () => { ready(); await Promise.resolve() })
  fireEvent.click(screen.getByText("John Doe"))
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /call/i }))
  })
  jest.runOnlyPendingTimers()
  await act(async () => {})
  expect(lastDevice.newCall).toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: /mute/i }))
  expect(lastDevice.newCall.mock.results[0].value.toggleAudioMute).toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: /hold/i }))
  expect(lastDevice.newCall.mock.results[0].value.toggleHold).toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: /hang up/i }))
  expect(lastDevice.newCall.mock.results[0].value.hangup).toHaveBeenCalled()
})
