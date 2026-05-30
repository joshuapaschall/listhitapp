import { describe, expect, test } from "vitest"
import { isValidEmailSyntax } from "@/lib/email/validate-syntax"

describe("isValidEmailSyntax", () => {
  test("accepts valid addresses", () => {
    expect(isValidEmailSyntax("buyer@example.com")).toBe(true)
    expect(isValidEmailSyntax("first.last+tag@sub.example.co")).toBe(true)
  })

  test("rejects missing at sign", () => {
    expect(isValidEmailSyntax("buyer.example.com")).toBe(false)
  })

  test("rejects double at signs", () => {
    expect(isValidEmailSyntax("buyer@@example.com")).toBe(false)
  })

  test("rejects spaces", () => {
    expect(isValidEmailSyntax("buyer name@example.com")).toBe(false)
    expect(isValidEmailSyntax("buyer@example .com")).toBe(false)
  })

  test("rejects domains without a TLD dot", () => {
    expect(isValidEmailSyntax("buyer@example")).toBe(false)
  })

  test("rejects consecutive dots", () => {
    expect(isValidEmailSyntax("buyer..name@example.com")).toBe(false)
    expect(isValidEmailSyntax("buyer@example..com")).toBe(false)
  })

  test("rejects empty local parts", () => {
    expect(isValidEmailSyntax("@example.com")).toBe(false)
  })
})
