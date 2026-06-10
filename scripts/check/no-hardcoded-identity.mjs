#!/usr/bin/env node
// Fails (exit 1) if any scanned file hardcodes real-looking identity data:
// email addresses, real phone numbers, street addresses, or named testimonials.
// Templates/blocks must use editable fields + per-tenant tokens instead.
//
// Usage: node scripts/check/no-hardcoded-identity.mjs <file> [file...]
import { readFileSync } from "node:fs"

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error("usage: no-hardcoded-identity.mjs <file> [file...]")
  process.exit(2)
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const PHONE = /\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/g
// Reserved-for-fiction: 555-0100..555-0199, plus the all-fives placeholder.
const PHONE_OK = (m) => /555-01\d\d/.test(m) || /555-5555/.test(m)
const STREET = /\b\d{2,5}\s+[A-Z][a-z]+\s+(St|Ave|Rd|Dr|Blvd|Lane|Ln|Way|Ct|Pl)\b/
// A quoted value assigned to an author:/name: field that looks like a person.
const NAMED = /\b(?:author|name)\s*:\s*"([^"]+)"/i
const PERSON = /^[A-Z][a-z]+\s+[A-Z][a-z]*\.?$/

const violations = []
function flag(file, lineNo, rule, text) {
  violations.push({ file, lineNo, rule, text: text.trim().slice(0, 160) })
}

for (const file of files) {
  let src
  try {
    src = readFileSync(file, "utf8")
  } catch {
    console.error(`! cannot read ${file}`)
    process.exit(2)
  }
  src.split("\n").forEach((line, i) => {
    const lineNo = i + 1

    const email = line.match(EMAIL)
    if (email) flag(file, lineNo, "email address", line)

    let m
    PHONE.lastIndex = 0
    while ((m = PHONE.exec(line)) !== null) {
      if (!PHONE_OK(m[0])) flag(file, lineNo, `real-looking phone (${m[0]})`, line)
    }

    if (STREET.test(line)) flag(file, lineNo, "street address", line)

    const named = line.match(NAMED)
    if (named && PERSON.test(named[1].trim())) {
      flag(file, lineNo, `named person ("${named[1]}")`, line)
    }
  })
}

if (violations.length) {
  console.error(`\n✖ no-hardcoded-identity: ${violations.length} violation(s)\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.lineNo}  [${v.rule}]\n    ${v.text}`)
  }
  console.error("\nUse editable fields + per-tenant data, never hardcoded identity.\n")
  process.exit(1)
}

console.log(`✓ no-hardcoded-identity: clean (${files.length} file(s))`)
process.exit(0)
