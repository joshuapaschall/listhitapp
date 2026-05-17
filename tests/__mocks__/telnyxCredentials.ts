import { vi } from "vitest"

export const createAgentTelephonyCredentialMock = vi.fn(async () => ({}))
export const createWebRTCTokenMock = vi.fn(async () => ({ token: "mock-token" }))
export const deleteTelnyxCredentialMock = vi.fn(async () => ({}))

export function __setTokenResponse(response: any) {
  createWebRTCTokenMock.mockResolvedValue(response)
}

export function createAgentTelephonyCredential(...args: any[]) {
  return createAgentTelephonyCredentialMock(...args)
}

export function createWebRTCToken(...args: any[]) {
  return createWebRTCTokenMock(...args)
}

export function deleteTelnyxCredential(...args: any[]) {
  return deleteTelnyxCredentialMock(...args)
}
