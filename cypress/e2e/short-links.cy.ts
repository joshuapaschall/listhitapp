describe("short links via properties ui", () => {
  it("creates, edits and deletes a short link", () => {
    cy.task("createShortLink", { originalURL: "http://example.com" }).then((data: any) => {
      expect(data.shortURL).to.eq("http://s.io/a")
      const id = data.idString
      cy.task("updateSlug", { id, path: "new-slug" }).then((upd: any) => {
        expect(upd.path).to.eq("new-slug")
        cy.task("deleteLink", { id }).then((del: any) => {
          expect(del.success).to.be.true
        })
      })
    })
  })
})
