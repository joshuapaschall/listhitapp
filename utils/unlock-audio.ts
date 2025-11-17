export function unlockAudio(
  audio: HTMLAudioElement,
  onUnlock?: () => void,
): () => void {
  if (typeof window === "undefined") return () => {}

  audio.preload = "auto"
  audio.muted = true
  audio.load()

  const unlock = () => {
    audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
        onUnlock?.()
      })
      .catch(() => {})
  }

  const opts = { once: true } as const
  window.addEventListener("click", unlock, opts)
  window.addEventListener("touchstart", unlock, opts)
  window.addEventListener("keydown", unlock, opts)

  return () => {
    window.removeEventListener("click", unlock)
    window.removeEventListener("touchstart", unlock)
    window.removeEventListener("keydown", unlock)
  }
}
export default unlockAudio
