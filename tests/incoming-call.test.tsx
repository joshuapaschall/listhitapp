/** @jest-environment jsdom */
import { render, fireEvent, screen } from "@testing-library/react"
import IncomingCall from "../components/voice/IncomingCall"

jest.mock("../components/voice/TelnyxDeviceProvider", () => ({
  useTelnyxDevice: () => ({ rejectIncomingCall: jest.fn() })
}))

describe("IncomingCall", () => {
  test("renders popup when ringing", () => {
    const call = {
      state: "ringing",
      direction: "inbound",
      parameters: { From: "+1555" },
      answer: jest.fn(),
      hangup: jest.fn(),
    } as any
    render(
      <IncomingCall
        device={null as any}
        activeCall={call}
        pendingConference={null}
        onAccept={() => {}}
        onDecline={() => {}}
      />,
    )
    expect(screen.getByText(/incoming call from \+1555/i)).toBeTruthy()
    fireEvent.click(screen.getByText(/accept/i))
    expect(call.answer).toHaveBeenCalled()
  })
})
