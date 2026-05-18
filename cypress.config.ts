import { defineConfig } from "cypress"
import { NextRequest } from "next/server"

export default defineConfig({
  e2e: {
    specPattern: "cypress/e2e/**/*.cy.ts",
    setupNodeEvents(on) {
      on("task", {
        async createShortLink({ originalURL, path }: { originalURL: string; path?: string }) {
          // Calls the local /api/short-links route, which is now backed by the native
          // shortlink-service. The native service is stubbed via fetch mock so the test
          // doesn't need a live database.
          process.env.SHORT_LINK_DEFAULT_DOMAIN = "s.io"
          const mod = await import("./app/api/short-links/route")
          global.fetch = async () =>
            ({
              ok: true,
              json: async () => ({
                shortURL: "http://s.io/a",
                path: "slug",
                idString: "id1",
              }),
            }) as any
          const req = new NextRequest("http://test", {
            method: "POST",
            body: JSON.stringify({ originalURL, path }),
          })
          const res = await mod.POST(req)
          return await res.json()
        },
      })
    },
  },
})
