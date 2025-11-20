// tests/__mocks__/supabaseAuthHelpers.ts
import { jest } from "@jest/globals"

type Client = {
  auth: {
    getUser: (accessToken?: string | null) => Promise<{ data: { user: any | null }; error: any | null }>
  }
}

let mockUser: any = null

export const mockGetUser = jest.fn(async () => ({
  data: { user: mockUser },
  error: null,
}))

export function __setMockUser(user: any) {
  mockUser = user
}

export function __getMockUser() {
  return mockUser
}

export function createRouteHandlerClient(_opts: any): Client {
  return {
    auth: {
      getUser: mockGetUser,
    },
  }
}

export function createServerComponentClient(_opts: any): Client {
  return createRouteHandlerClient(_opts)
}

export function createClientComponentClient(_opts: any): Client {
  return createRouteHandlerClient(_opts)
}

export function createPagesServerClient(_opts: any): Client {
  return createRouteHandlerClient(_opts)
}

export function createMiddlewareClient(_opts: any): Client {
  return createRouteHandlerClient(_opts)
}

export function createBrowserSupabaseClient(_opts: any): Client {
  return createRouteHandlerClient(_opts)
}
