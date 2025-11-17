/** @jest-environment jsdom */
import { _onIceSdp, _onIce } from "../components/voice/ice-handlers"

describe("ice handlers", () => {
  test("_onIceSdp handles null", () => {
    const dispatch = jest.spyOn(window, "dispatchEvent")
    expect(() => _onIceSdp(null as any)).not.toThrow()
    expect(dispatch).toHaveBeenCalledWith(expect.any(CustomEvent))
  })

  test("_onIce ignores missing localDescription", () => {
    expect(() => _onIce({ localDescription: null })).not.toThrow()
  })

  test("_onIce forwards localDescription", () => {
    const desc = { sdp: "s", type: "offer" }
    const spy = jest.spyOn(require("../components/voice/ice-handlers"), "_onIceSdp")
    _onIce({ localDescription: desc })
    expect(spy).toHaveBeenCalledWith(desc)
  })
})
