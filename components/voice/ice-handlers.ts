export const _onIceSdp = (
  e: RTCSessionDescriptionInit | null | undefined,
): void => {
  if (!e || !e.sdp || !e.type) {
    console.warn("Invalid ICE SDP event", e)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("telnyxCallError", {
          detail: { message: "Invalid ICE event data" },
        }),
      )
    }
    return
  }
}

export const _onIce = (
  t: { localDescription: RTCSessionDescriptionInit | null } | null | undefined,
): void => {
  if (t?.localDescription) {
    _onIceSdp(t.localDescription)
  }
}
