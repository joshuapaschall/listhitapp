import type { Twilio } from "twilio"

// Twilio's inventory for a busy area code is intermittent: the same search can
// return nothing and then a number a second later. A customer must never see an
// empty list, so the search widens step by step and stops at the first hit:
// area code (retried once) → overlay codes for the same metro → near the
// business phone/ZIP → anywhere in the state. Every step requires SMS + voice.

export type Candidate = {
  phoneNumber: string
  friendlyName?: string | null
  locality?: string | null
  region?: string | null
}

export type MatchedBy = "area_code" | "overlay" | "nearby" | "state"

export type NumberSearchInput = {
  areaCode?: string | null
  contains?: string | null
  nearPhone?: string | null
  postalCode?: string | null
  state?: string | null
  limit: number
}

type SearchClient = Pick<Twilio, "availablePhoneNumbers">

const RETRY_DELAY_MS = 400
const NEARBY_DISTANCE_MILES = 50

// Area codes that cover the same metro (overlays). A code may appear in more
// than one group; overlaysFor() merges them.
const OVERLAY_GROUPS: string[][] = [
  ["770", "678", "470", "404", "943"], // Atlanta
  ["212", "646", "332", "917"], // New York
  ["213", "323", "310", "424", "818"], // Los Angeles
  ["312", "773", "872"], // Chicago
  ["305", "786"], // Miami
  ["214", "469", "972"], // Dallas
  ["713", "281", "832"], // Houston
  ["602", "480", "623"], // Phoenix
  ["702", "725"], // Las Vegas
  ["615", "629"], // Nashville
  ["704", "980"], // Charlotte
  ["407", "689"], // Orlando
  ["813", "656"], // Tampa
  ["210", "726"], // San Antonio
  ["512", "737"], // Austin
  ["317", "463"], // Indianapolis
]

export function overlaysFor(areaCode: string): string[] {
  const out: string[] = []
  for (const group of OVERLAY_GROUPS) {
    if (!group.includes(areaCode)) continue
    for (const code of group) if (code !== areaCode && !out.includes(code)) out.push(code)
  }
  return out
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function searchLocalNumbers(
  client: SearchClient,
  input: NumberSearchInput,
): Promise<{ results: Candidate[]; matchedBy: MatchedBy }> {
  const base = { smsEnabled: true, voiceEnabled: true, limit: input.limit }
  const areaCode = /^\d{3}$/.test(input.areaCode ?? "") ? input.areaCode! : null
  const contains = (input.contains ?? "").trim()
  const nearPhone = /^\+1\d{10}$/.test(input.nearPhone ?? "") ? input.nearPhone! : null
  const postalCode = /^\d{5}$/.test((input.postalCode ?? "").trim()) ? input.postalCode!.trim() : null
  const state = /^[A-Za-z]{2}$/.test((input.state ?? "").trim()) ? input.state!.trim().toUpperCase() : null

  // A failing step (bad parameter, transient error) never stops the widening;
  // only when every step comes back empty is the first error surfaced.
  let firstError: unknown = null
  const list = async (params: Record<string, unknown>): Promise<Candidate[]> => {
    try {
      return await client.availablePhoneNumbers("US").local.list({ ...base, ...params })
    } catch (err) {
      firstError ??= err
      return []
    }
  }

  if (areaCode) {
    const exact = { areaCode: Number(areaCode), ...(contains ? { contains } : {}) }
    let results = await list(exact)
    if (!results.length) {
      await sleep(RETRY_DELAY_MS)
      results = await list(exact)
    }
    if (results.length) return { results, matchedBy: "area_code" }

    for (const code of overlaysFor(areaCode)) {
      results = await list({ areaCode: Number(code) })
      if (results.length) return { results, matchedBy: "overlay" }
    }
  }

  if (nearPhone || postalCode) {
    const results = await list(
      nearPhone
        ? { nearNumber: nearPhone, distance: NEARBY_DISTANCE_MILES }
        : { inPostalCode: postalCode, distance: NEARBY_DISTANCE_MILES },
    )
    if (results.length) return { results, matchedBy: "nearby" }
  }

  if (state) {
    const results = await list({ inRegion: state })
    if (results.length) return { results, matchedBy: "state" }
  }

  if (firstError) throw firstError
  return { results: [], matchedBy: areaCode ? "area_code" : "state" }
}
