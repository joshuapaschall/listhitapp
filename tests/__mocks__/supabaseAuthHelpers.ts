// tests/__mocks__/supabaseAuthHelpers.ts
import { vi } from "vitest"

type Client = {
  auth: {
    getUser: (accessToken?: string | null) => Promise<{ data: { user: any | null }; error: any | null }>
  }
  from: (table: string) => any
}

let mockUser: any = null

export const mockGetUser = vi.fn(async () => ({
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
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { role: "admin" }, error: null }),
            }),
          }),
        }
      }

      if (table === "permissions") {
        const query = {
          eq: () => query,
          then: (resolve: any) => resolve({ data: [], error: null }),
        }
        return {
          select: () => query,
        }
      }

      throw new Error(`Unexpected mock auth helper table ${table}`)
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
