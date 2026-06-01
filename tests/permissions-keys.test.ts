import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
} from "../lib/permissions/keys"
import { PERMISSION_TEMPLATES, grantsForTemplate } from "../lib/permissions/templates"

describe("permission keys and templates", () => {
  test("every template grant is a valid permission key", () => {
    const validKeys = new Set(PERMISSION_KEYS)

    for (const template of PERMISSION_TEMPLATES) {
      expect(template.grants.every((grant) => validKeys.has(grant))).toBe(true)
      expect(grantsForTemplate(template.id)).toEqual([...template.grants])
    }
  })

  test("permission catalog covers every key exactly once", () => {
    const catalogKeys = PERMISSION_CATALOG.map((entry) => entry.key)

    expect(catalogKeys).toHaveLength(25)
    expect(catalogKeys).toHaveLength(PERMISSION_KEYS.length)
    expect(new Set(catalogKeys).size).toBe(PERMISSION_KEYS.length)
    expect(catalogKeys).toEqual([...PERMISSION_KEYS])
  })

  test("groups are non-empty", () => {
    for (const group of PERMISSION_GROUPS) {
      expect(PERMISSION_CATALOG.some((entry) => entry.group === group)).toBe(true)
    }
  })
})
