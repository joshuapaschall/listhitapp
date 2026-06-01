/** @jest-environment jsdom */
import { _onIceSdp, _onIce } from "../components/voice/ice-handlers"

describe("ice handlers", () => {
  test("_onIceSdp handles null", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent")
    expect(() => _onIceSdp(null as any)).not.toThrow()
    expect(dispatch).toHaveBeenCalledWith(expect.any(CustomEvent))
  })

  test("_onIce ignores missing localDescription", () => {
    expect(() => _onIce({ localDescription: null })).not.toThrow()
  })

  test("_onIce with a valid localDescription dispatches no error", () => {
    const spy = vi.fn()
    window.addEventListener("telnyxCallError", spy)
    _onIce({ localDescription: { sdp: "s", type: "offer" } as any })
    expect(spy).not.toHaveBeenCalled()
    window.removeEventListener("telnyxCallError", spy)
  })

  test("_onIce with an invalid localDescription dispatches telnyxCallError", () => {
    const spy = vi.fn()
    window.addEventListener("telnyxCallError", spy)
    // localDescription present but missing sdp/type -> _onIceSdp dispatches the error
    _onIce({ localDescription: { type: "offer" } as any })
    expect(spy).toHaveBeenCalled()
    window.removeEventListener("telnyxCallError", spy)
  })
})
