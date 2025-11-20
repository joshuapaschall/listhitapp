import { jest } from "@jest/globals"

export const createAgentTelephonyCredentialMock = jest.fn(async () => ({}))
export const createWebRTCTokenMock = jest.fn(async () => ({ token: "mock-token" }))
export const deleteTelnyxCredentialMock = jest.fn(async () => ({}))

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
