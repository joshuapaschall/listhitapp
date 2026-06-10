// Shared types for the A2P 10DLC registration step. Pure types — no server
// imports, safe to use from client and server.

export type A2pStatus = "draft" | "ready"

// Mirrors the a2p_registration table.
export interface A2pRegistration {
  id: string
  org_id: string
  use_case: string
  campaign_description: string | null
  sample_message_1: string | null
  sample_message_2: string | null
  opt_in_url: string | null
  status: A2pStatus
  created_at: string
  updated_at: string
}

// What GET returns: brand identity assembled from business_verification +
// organizations (read live, never duplicated), the generated program copy, the
// two samples, the resolved status, and dependency signals for the UI.
export interface A2pAssembledState {
  brand: {
    legalDisplay: string
    einMasked: string
    address: string
    contactName: string
    contactEmail: string
    phone: string
  }
  program: {
    useCaseLabel: string
    campaignDescription: string
    optInUrl: string
  }
  samples: {
    sample1: string
    sample2: string
  }
  status: A2pStatus
  ready: {
    verifyReady: boolean
    websiteSet: boolean
  }
}
