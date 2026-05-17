export interface CampaignAudienceSnapshot {
  createdAt: string
  source: "buyers-filter"
  channel: "email" | "sms"
  search?: string
  selectedTags?: string[]
  excludeTags?: string[]
  selectedLocations?: string[]
  minScore?: string
  maxScore?: string
  vip?: string
  vetted?: string
  canReceiveEmail?: string
  canReceiveSMS?: string
  createdAfter?: string
  createdBefore?: string
  propertyType?: string
  buyerIds: string[]
  recipientCount: number
}

const KEY = "listhit:pendingCampaignAudience"

export function saveAudienceSnapshot(s: CampaignAudienceSnapshot) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(KEY, JSON.stringify(s))
}

export function readAudienceSnapshot(): CampaignAudienceSnapshot | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CampaignAudienceSnapshot
  } catch {
    return null
  }
}

export function clearAudienceSnapshot() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(KEY)
}
