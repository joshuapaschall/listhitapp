#!/usr/bin/env node
// Fails (exit 1) if any scanned file hardcodes a concrete US location instead of
// using a {Market}/{Area} token. Keeps templates location-agnostic so every
// tenant renders their own market.
//
// Usage: node scripts/check/no-hardcoded-location.mjs <file> [file...]
// (PR 2 will pass personas.ts + templates as additional args.)
import { readFileSync } from "node:fs"

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error("usage: no-hardcoded-location.mjs <file> [file...]")
  process.exit(2)
}

// Obvious city tokens from our mocks/seeds — extend as needed.
const CITY_DENYLIST = ["Atlanta", "Decatur", "Marietta", "Tifton", "Perimeter"]
// Phrases that signal hardcoded geographic copy.
const PHRASE_DENYLIST = ["surrounding counties", "metro area"]
// "City, ST" style or a bare ", ST" state abbreviation in prose.
const STATE_ABBR = /,\s(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/

const cityRe = new RegExp(`\\b(${CITY_DENYLIST.join("|")})\\b`)
const phraseRe = new RegExp(`\\b(${PHRASE_DENYLIST.join("|")})\\b`, "i")

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
    const city = line.match(cityRe)
    if (city) flag(file, lineNo, `hardcoded city ("${city[1]}")`, line)
    const phrase = line.match(phraseRe)
    if (phrase) flag(file, lineNo, `geographic phrase ("${phrase[1]}")`, line)
    if (STATE_ABBR.test(line)) flag(file, lineNo, "hardcoded state abbreviation", line)
  })
}

if (violations.length) {
  console.error(`\n✖ no-hardcoded-location: ${violations.length} violation(s)\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.lineNo}  [${v.rule}]\n    ${v.text}`)
  }
  console.error("\nUse a {Market}/{Area} token instead of a concrete location.\n")
  process.exit(1)
}

console.log(`✓ no-hardcoded-location: clean (${files.length} file(s))`)
process.exit(0)
