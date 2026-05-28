/**
 * How long (seconds) to ring a PSTN forwarding number before treating it as
 * unanswered and falling through to voicemail. Distinct from
 * browser_ring_timeout_seconds (which is per-market/per-number and short, to
 * give the in-browser agent a chance); a PSTN forward should ring long enough
 * for a cell to pick up.
 */
export const FORWARD_RING_TIMEOUT_SECONDS = 25;
