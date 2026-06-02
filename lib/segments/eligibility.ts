// Single source of truth for channel-eligibility / suppression.
//
// Email and SMS consent are independent. The send route and the segment engine
// MUST gate on the same predicate so a preview count equals the real send.
//
//   email: deleted_at IS NULL AND email_suppressed = false
//          AND can_receive_email = true AND email IS NOT NULL
//   sms:   deleted_at IS NULL AND can_receive_sms = true
//          AND sms_suppressed = false AND phone IS NOT NULL
//
// Note SMS is NOT gated on email_suppressed — an email hard-bounce must not block
// an SMS-opted-in buyer. STOP compliance is enforced by can_receive_sms /
// sms_suppressed (set by the Telnyx STOP webhook + lib/sms/suppress.ts).

// Applies the channel-eligibility predicate to a Supabase query. Works on a
// plain buyers query (prefix "") or a joined query (e.g. prefix "buyers." for a
// campaign_recipients → buyers!inner join). Adds ONLY the
// suppression/consent/contactability/deleted filters — callers add their own
// org/id scoping.
export function applyChannelEligibility<T>(query: T, channel: "email" | "sms", prefix = ""): T {
  const col = (c: string) => `${prefix}${c}`
  let q: any = (query as any).is(col("deleted_at"), null)
  if (channel === "email") {
    q = q
      .eq(col("email_suppressed"), false)
      .eq(col("can_receive_email"), true)
      .not(col("email"), "is", null)
  } else {
    q = q
      .eq(col("can_receive_sms"), true)
      .eq(col("sms_suppressed"), false)
      .not(col("phone"), "is", null)
  }
  return q as T
}
