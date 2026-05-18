// TODO(A.5.1): Rewire this Cypress test for the native short-link service.
// The previous Short.io-backed task mocked `global.fetch`; the native service
// goes through Supabase directly, which Cypress can't trivially intercept here.
// Re-enable once we either (a) point at a seeded Supabase test schema or
// (b) refactor the service to allow injectable storage. See the A.5.1 PR.
//
// describe("short links via properties ui", () => {
//   it("creates, edits and deletes a short link", () => {
//     cy.task("createShortLink", { originalURL: "http://example.com" }).then((data: any) => {
//       expect(data.shortURL).to.eq("http://s.io/a")
//       const id = data.idString
//       cy.task("updateSlug", { id, path: "new-slug" }).then((upd: any) => {
//         expect(upd.path).to.eq("new-slug")
//         cy.task("deleteLink", { id }).then((del: any) => {
//           expect(del.success).to.be.true
//         })
//       })
//     })
//   })
// })

export {}
