// The approvals pages exist only for platform admins: anyone else gets a 404
// (notFound), not a 403, so the admin surface isn't discoverable.

const h = vi.hoisted(() => ({ user: null as any }))

vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, getAll: () => [] }) }))
vi.mock("@supabase/auth-helpers-nextjs", () => ({
  createServerComponentClient: () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" })
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/approvals",
}))
vi.mock("@/components/layout/main-layout", () => ({ default: ({ children }: any) => children }))
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: () => { throw new Error("must not query for non-admins") } } }))

import ApprovalsPage from "@/app/(app)/admin/approvals/page"
import ApprovalDetailPage from "@/app/(app)/admin/approvals/[orgId]/page"
import EmailPreviewsPage from "@/app/(app)/admin/email-previews/page"

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

beforeEach(() => {
  process.env.PLATFORM_ADMIN_USER_IDS = ADMIN
})

describe("admin approval pages", () => {
  test("a signed-in non-admin gets a 404", async () => {
    h.user = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
    await expect(ApprovalsPage()).rejects.toThrow("NEXT_NOT_FOUND")
    await expect(ApprovalDetailPage({ params: { orgId: "11111111-1111-4111-8111-111111111111" } })).rejects.toThrow("NEXT_NOT_FOUND")
    await expect(EmailPreviewsPage()).rejects.toThrow("NEXT_NOT_FOUND")
  })

  test("a signed-out visitor gets a 404", async () => {
    h.user = null
    await expect(ApprovalsPage()).rejects.toThrow("NEXT_NOT_FOUND")
  })

  test("a platform admin gets the page", async () => {
    h.user = { id: ADMIN }
    await expect(ApprovalsPage()).resolves.toBeTruthy()
  })
})
