import { defineConfig } from "cypress"
import { NextRequest } from "next/server"

export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.ts",
    setupNodeEvents(on) {
      on("task", {
        async createShortLink({ originalURL, path }: { originalURL: string; path?: string }) {
          process.env.SHORTIO_API_KEY = "key"
          process.env.SHORTIO_DOMAIN = "s.io"
          const mod = await import("./app/api/short-links/route")
          global.fetch = async () => ({
            ok: true,
            json: async () => ({ shortURL: "http://s.io/a", path: "slug", idString: "id1" }),
          }) as any
          const req = new NextRequest("http://test", {
            method: "POST",
            body: JSON.stringify({ originalURL, path }),
          })
          const res = await mod.POST(req)
          return await res.json()
        },
        async updateSlug({ id, path }: { id: string; path: string }) {
          process.env.SHORTIO_API_KEY = "key"
          const mod = await import("./app/api/short-links/[id]/route")
          global.fetch = async () => ({
            ok: true,
            json: async () => ({ path }),
          }) as any
          const req = new NextRequest("http://test", {
            method: "PATCH",
            body: JSON.stringify({ path }),
          })
          const res = await mod.PATCH(req, { params: { id } })
          return await res.json()
        },
        async deleteLink({ id }: { id: string }) {
          process.env.SHORTIO_API_KEY = "key"
          const mod = await import("./app/api/short-links/[id]/route")
          global.fetch = async () => ({ ok: true, json: async () => ({}) }) as any
          const req = new NextRequest("http://test", { method: "DELETE" })
          const res = await mod.DELETE(req, { params: { id } })
          return await res.json()
        },
      })
    },
  },
})
