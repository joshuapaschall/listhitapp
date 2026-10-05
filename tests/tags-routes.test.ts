// Every tag write goes through these routes: the cascade functions are
// service-role only, so the session + permission check here is the only gate.

import { NextRequest } from "next/server"

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  orgId: "org-A" as string | null,
  permissions: new Set<string>(),
  // rpc name -> error to return
  rpcError: null as any,
  rpcCalls: [] as Array<{ fn: string; args: any }>,
  tagRows: [] as any[],
  tagUpdates: [] as any[],
  ensureResult: ["Canonical Name"] as string[],
  usageRows: [] as any[],
  existingByName: null as any,
}))

vi.mock("@/lib/auth/org-context", () => ({
  requireOrgContext: async () => ({
    user: state.user,
    orgId: state.orgId,
    supabase: {
      from: (table: string) => {
        if (table !== "tags") throw new Error(`Unexpected session table ${table}`)
        const q: any = {
          select: () => q,
          eq: () => q,
          order: async () => ({ data: state.tagRows, error: null }),
        }
        return q
      },
    },
  }),
}))

vi.mock("@/lib/permissions/server", () => ({
  hasPermission: async (_client: unknown, key: string) => state.permissions.has(key),
  requirePermission: async (_client: unknown, key: string) => {
    if (state.permissions.has(key)) return null
    const { NextResponse } = await import("next/server")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  },
}))

vi.mock("@/lib/tags/ensure", () => ({
  ensureTagsExist: async () => state.ensureResult,
}))

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    rpc: async (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args })
      if (state.rpcError) return { data: null, error: state.rpcError }
      return { data: fn === "tag_usage" ? state.usageRows : null, error: null }
    },
    from: (table: string) => {
      if (table !== "tags") throw new Error(`Unexpected admin table ${table}`)
      const q: any = {
        select: () => q,
        eq: () => q,
        ilike: () => q,
        maybeSingle: async () => ({
          data:
            q._mode === "update"
              ? { id: "tag-1" }
              : q._existing
                ? state.existingByName
                : state.tagRows[0] ?? null,
          error: null,
        }),
        update: (payload: any) => {
          state.tagUpdates.push(payload)
          q._mode = "update"
          return q
        },
      }
      return q
    },
  },
}))

import { GET as listTags, POST as createTag } from "../app/api/tags/route"
import { GET as tagUsage } from "../app/api/tags/usage/route"
import { POST as ensureTags } from "../app/api/tags/ensure/route"
import { PATCH as patchTag, DELETE as deleteTag } from "../app/api/tags/[id]/route"
import { POST as mergeTag } from "../app/api/tags/[id]/merge/route"

const params = { params: { id: "tag-1" } }

const jsonReq = (body: unknown) =>
  new NextRequest("http://test/api/tags", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

function grant(...keys: string[]) {
  state.permissions = new Set(keys)
}

describe("tag routes", () => {
  beforeEach(() => {
    state.user = { id: "user-1" }
    state.orgId = "org-A"
    state.permissions = new Set()
    state.rpcError = null
    state.rpcCalls = []
    state.tagRows = [{ id: "tag-1", name: "Investor", color: "#3B82F6", is_protected: false }]
    state.tagUpdates = []
    state.ensureResult = ["Canonical Name"]
    state.usageRows = [{ id: "tag-1", name: "Investor", buyers: 3 }]
    state.existingByName = null
  })

  describe("auth and org", () => {
    test("401 with no user", async () => {
      state.user = null
      expect((await listTags()).status).toBe(401)
      expect((await tagUsage()).status).toBe(401)
      expect((await createTag(jsonReq({ name: "X" }))).status).toBe(401)
      expect((await ensureTags(jsonReq({ names: ["X"] }))).status).toBe(401)
      expect((await patchTag(jsonReq({ color: "#111111" }), params)).status).toBe(401)
      expect((await deleteTag(jsonReq({}), params)).status).toBe(401)
      expect((await mergeTag(jsonReq({ targetId: "t2" }), params)).status).toBe(401)
    })

    test("403 with no org", async () => {
      state.orgId = null
      grant("settings.tags", "buyers.view", "buyers.edit")
      expect((await listTags()).status).toBe(403)
      expect((await tagUsage()).status).toBe(403)
      expect((await createTag(jsonReq({ name: "X" }))).status).toBe(403)
      expect((await ensureTags(jsonReq({ names: ["X"] }))).status).toBe(403)
      expect((await patchTag(jsonReq({ color: "#111111" }), params)).status).toBe(403)
      expect((await deleteTag(jsonReq({}), params)).status).toBe(403)
      expect((await mergeTag(jsonReq({ targetId: "t2" }), params)).status).toBe(403)
    })
  })

  describe("permission denial", () => {
    test("GET /api/tags needs buyers.view or properties.view", async () => {
      expect((await listTags()).status).toBe(403)
      grant("properties.view")
      expect((await listTags()).status).toBe(200)
    })

    test("usage, patch, delete and merge need settings.tags", async () => {
      grant("buyers.edit")
      expect((await tagUsage()).status).toBe(403)
      expect((await patchTag(jsonReq({ color: "#111111" }), params)).status).toBe(403)
      expect((await deleteTag(jsonReq({}), params)).status).toBe(403)
      expect((await mergeTag(jsonReq({ targetId: "t2" }), params)).status).toBe(403)
      expect(state.rpcCalls).toHaveLength(0)
    })

    test("POST /api/tags accepts any of three permissions", async () => {
      expect((await createTag(jsonReq({ name: "X" }))).status).toBe(403)
      grant("settings.tags")
      expect([200, 201]).toContain((await createTag(jsonReq({ name: "X" }))).status)
    })

    test("ensure needs buyers.edit or buyers.import", async () => {
      expect((await ensureTags(jsonReq({ names: ["X"] }))).status).toBe(403)
      grant("buyers.import")
      expect((await ensureTags(jsonReq({ names: ["X"] }))).status).toBe(200)
    })
  })

  describe("success paths", () => {
    test("GET /api/tags returns the org's vocabulary", async () => {
      grant("buyers.view")
      const res = await listTags()
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ tags: state.tagRows })
    })

    test("GET /api/tags/usage calls the rpc with the session org", async () => {
      grant("settings.tags")
      const res = await tagUsage()
      expect(res.status).toBe(200)
      expect(state.rpcCalls).toEqual([{ fn: "tag_usage", args: { p_org_id: "org-A" } }])
    })

    test("POST /api/tags returns the CANONICAL name, not what was typed", async () => {
      grant("buyers.edit")
      state.ensureResult = ["Atlanta Closers"]
      state.tagRows = [
        { id: "tag-9", name: "Atlanta Closers", color: "#3B82F6", is_protected: false },
      ]

      const res = await createTag(jsonReq({ name: "atlanta closers" }))
      const body = await res.json()
      expect(body.tag.name).toBe("Atlanta Closers")
    })

    test("POST /api/tags/ensure returns canonical names", async () => {
      grant("buyers.edit")
      state.ensureResult = ["One", "Two"]
      const res = await ensureTags(jsonReq({ names: ["one", "two"] }))
      await expect(res.json()).resolves.toEqual({ names: ["One", "Two"] })
    })

    test("PATCH name goes through tag_rename", async () => {
      grant("settings.tags")
      const res = await patchTag(jsonReq({ name: "Renamed" }), params)
      expect(res.status).toBe(200)
      expect(state.rpcCalls[0]).toEqual({
        fn: "tag_rename",
        args: { p_org_id: "org-A", p_tag_id: "tag-1", p_new_name: "Renamed" },
      })
    })

    test("DELETE goes through tag_delete", async () => {
      grant("settings.tags")
      const res = await deleteTag(jsonReq({}), params)
      expect(res.status).toBe(200)
      expect(state.rpcCalls[0]).toEqual({
        fn: "tag_delete",
        args: { p_org_id: "org-A", p_tag_id: "tag-1" },
      })
    })

    test("merge goes through tag_merge", async () => {
      grant("settings.tags")
      const res = await mergeTag(jsonReq({ targetId: "tag-2" }), params)
      expect(res.status).toBe(200)
      expect(state.rpcCalls[0]).toEqual({
        fn: "tag_merge",
        args: { p_org_id: "org-A", p_source_id: "tag-1", p_target_id: "tag-2" },
      })
    })
  })

  describe("validation", () => {
    test("color must be a 6-digit hex", async () => {
      grant("settings.tags")
      const res = await patchTag(jsonReq({ color: "red" }), params)
      expect(res.status).toBe(400)
      expect(state.tagUpdates).toHaveLength(0)
    })

    test("a valid color is written without touching the cascade", async () => {
      grant("settings.tags")
      const res = await patchTag(jsonReq({ color: "#AbC123" }), params)
      expect(res.status).toBe(200)
      expect(state.tagUpdates).toEqual([{ color: "#AbC123" }])
      expect(state.rpcCalls).toHaveLength(0)
    })

    test("POST /api/tags rejects an empty or over-long name", async () => {
      grant("settings.tags")
      expect((await createTag(jsonReq({ name: "   " }))).status).toBe(400)
      expect((await createTag(jsonReq({ name: "x".repeat(61) }))).status).toBe(400)
    })

    test("POST /api/tags rejects a bad color", async () => {
      grant("settings.tags")
      expect((await createTag(jsonReq({ name: "X", color: "blue" }))).status).toBe(400)
    })

    test("ensure rejects a non-array and an over-long list", async () => {
      grant("buyers.edit")
      expect((await ensureTags(jsonReq({ names: "nope" }))).status).toBe(400)
      const tooMany = Array.from({ length: 501 }, (_, i) => `t${i}`)
      expect((await ensureTags(jsonReq({ names: tooMany }))).status).toBe(400)
    })

    test("merge requires a targetId", async () => {
      grant("settings.tags")
      expect((await mergeTag(jsonReq({}), params)).status).toBe(400)
      expect(state.rpcCalls).toHaveLength(0)
    })

    test("PATCH with nothing to change is a 400", async () => {
      grant("settings.tags")
      expect((await patchTag(jsonReq({}), params)).status).toBe(400)
    })
  })

  describe("rpc error mapping", () => {
    beforeEach(() => grant("settings.tags"))

    test("protected_tag → 403", async () => {
      state.rpcError = { message: 'protected_tag' }
      const res = await deleteTag(jsonReq({}), params)
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toEqual({
        error: "System tags can't be renamed, merged, or deleted.",
      })
    })

    test("name_taken → 409", async () => {
      state.rpcError = { message: 'name_taken' }
      const res = await patchTag(jsonReq({ name: "Taken" }), params)
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: "A tag with that name already exists — use Merge instead.",
      })
    })

    test("tag_not_found → 404", async () => {
      state.rpcError = { message: 'tag_not_found' }
      expect((await deleteTag(jsonReq({}), params)).status).toBe(404)
    })

    test("invalid_name → 400", async () => {
      state.rpcError = { message: 'invalid_name' }
      expect((await patchTag(jsonReq({ name: "x" }), params)).status).toBe(400)
    })

    test("same_tag → 400", async () => {
      state.rpcError = { message: 'same_tag' }
      expect((await mergeTag(jsonReq({ targetId: "tag-1" }), params)).status).toBe(400)
    })

    test("anything else → 500", async () => {
      state.rpcError = { message: "connection reset" }
      const err = vi.spyOn(console, "error").mockImplementation(() => {})
      expect((await deleteTag(jsonReq({}), params)).status).toBe(500)
      expect(err).toHaveBeenCalled()
      err.mockRestore()
    })
  })
})
