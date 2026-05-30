#!/usr/bin/env node
/**
 * test-safety-breaker.mjs
 * One-command end-to-end test for the email deliverability circuit breaker (Phase 1).
 *
 * WHAT IT DOES (all automatically, then cleans up):
 *   1. Creates a throwaway campaign "__SAFETY_BREAKER_TEST__"
 *   2. Inserts 60 recipients, 8 of them faked as HARD bounces (13% > 8% threshold)
 *   3. Queues 3 pending jobs pointed at AWS's mailbox simulator (safe, never reaches a real inbox)
 *   4. Triggers the real /api/email-campaigns/process drain -> the breaker should TRIP
 *   5. Verifies: campaign status = paused_by_safety, queue jobs = paused, a notification fired
 *   6. Simulates "you fixed the list" (clears the fake bounces), hits /resume
 *   7. Verifies: campaign no longer paused, no jobs left in 'paused'
 *   8. Deletes everything it created
 *
 * HOW TO RUN (easiest path):
 *   Terminal A:  pnpm dev
 *   Terminal B:  node scripts/test-safety-breaker.mjs
 *
 * It auto-loads .env.local for SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET.
 * Defaults to http://localhost:3000. Override with:  BASE_URL=https://your-preview.vercel.app node ...
 * Add KEEP=1 to leave the test campaign in place so you can eyeball it in the UI.
 *
 * SAFETY: there is ONE Supabase project, so this runs against your real DB. It only ever
 * touches its own clearly-named test campaign. Triggering /process also drains any OTHER
 * pending email jobs, so don't run this while a real campaign is mid-send.
 */

import fs from "node:fs"
import path from "node:path"

// ---------- tiny .env.local loader ----------
function loadEnvLocal() {
  const out = {}
  const p = path.resolve(process.cwd(), ".env.local")
  if (!fs.existsSync(p)) return out
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const env = { ...loadEnvLocal(), ...process.env }
const BASE_URL = (env.BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const SUPABASE_URL = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = env.CRON_SECRET
const KEEP = env.KEEP === "1"

// ---------- pretty logging ----------
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" }
let passes = 0, fails = 0
const step = (s) => console.log(`\n${C.b}» ${s}${C.x}`)
const info = (s) => console.log(`  ${C.d}${s}${C.x}`)
const pass = (s) => { passes++; console.log(`  ${C.g}✓ ${s}${C.x}`) }
const fail = (s) => { fails++; console.log(`  ${C.r}✗ ${s}${C.x}`) }
const die = (s) => { console.error(`\n${C.r}${C.b}FATAL:${C.x} ${s}`); process.exit(1) }

if (!SUPABASE_URL) die("SUPABASE_URL not found (checked .env.local and env).")
if (!SERVICE_KEY) die("SUPABASE_SERVICE_ROLE_KEY not found.")
if (!CRON_SECRET) die("CRON_SECRET not found.")

// ---------- Supabase REST helpers (service role bypasses RLS) ----------
const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
}
async function sbInsert(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  })
  if (!res.ok) die(`insert ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}
async function sbSelect(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders })
  if (!res.ok) die(`select ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}
async function sbPatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  })
  if (!res.ok) die(`patch ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}
async function sbDelete(table, query) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers: sbHeaders })
}
async function appPost(pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, json, text }
}

const SIM = "success@simulator.amazonses.com"
const now = () => new Date().toISOString()
let campaignId = null

async function cleanup() {
  if (!campaignId || KEEP) {
    if (KEEP && campaignId) info(`KEEP=1 set — leaving campaign ${campaignId} in place. URL: ${BASE_URL}/campaigns/${campaignId}`)
    return
  }
  step("Cleanup")
  await sbDelete("email_campaign_queue", `campaign_id=eq.${campaignId}`)
  await sbDelete("campaign_recipients", `campaign_id=eq.${campaignId}`)
  await sbDelete("campaigns", `id=eq.${campaignId}`)
  // best-effort notification cleanup
  const notes = await sbSelect("notifications", `type=eq.campaign_paused_safety&select=id,metadata&order=created_at.desc&limit=20`)
  for (const n of notes) {
    if (n?.metadata?.campaignId === campaignId) await sbDelete("notifications", `id=eq.${n.id}`)
  }
  info("Removed test campaign, recipients, queue rows, and notification.")
}

async function main() {
  console.log(`${C.b}Email Safety Breaker — end-to-end test${C.x}`)
  info(`App:      ${BASE_URL}`)
  info(`Supabase: ${SUPABASE_URL}`)

  // Preflight: migration applied?
  step("Preflight")
  const probe = await fetch(`${SUPABASE_URL}/rest/v1/campaign_recipients?select=bounce_type&limit=1`, { headers: sbHeaders })
  if (!probe.ok) die(`Could not read campaign_recipients.bounce_type (status ${probe.status}). Run migration 20260529110000_email_safety_circuit_breaker.sql against your DB first.`)
  pass("bounce_type column exists (migration applied)")
  const health = await fetch(`${BASE_URL}/api/email-campaigns/process`, { method: "GET", headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  if (!health.ok && health.status !== 200) info(`(heads up: process endpoint returned ${health.status} on GET — continuing)`)
  pass(`app reachable at ${BASE_URL}`)

  // 1. Create campaign
  step("Setup: create test campaign + 60 recipients (8 hard bounces) + 3 pending jobs")
  const [camp] = await sbInsert("campaigns", {
    name: "__SAFETY_BREAKER_TEST__",
    channel: "email",
    status: "processing",
    subject: "safety test",
    message: "<p>safety test</p>",
  })
  campaignId = camp.id
  info(`campaign ${campaignId}`)

  // 2. Recipients: 52 clean (sent) + 8 hard-bounced
  const recipients = []
  for (let i = 0; i < 52; i++) recipients.push({ campaign_id: campaignId, buyer_id: null, sent_at: now(), status: "sent" })
  for (let i = 0; i < 8; i++) recipients.push({ campaign_id: campaignId, buyer_id: null, sent_at: now(), status: "bounced", bounce_type: "Permanent", bounced_at: now() })
  await sbInsert("campaign_recipients", recipients)
  info("60 recipients inserted (60 sent, 8 Permanent bounces = 13.3% > 8% threshold)")

  // 3. Queue 3 pending jobs (simulator address; breaker pauses them before any send)
  const past = new Date(Date.now() - 60_000).toISOString()
  const jobs = []
  for (let i = 0; i < 3; i++) {
    jobs.push({
      campaign_id: campaignId,
      recipient_id: null,
      buyer_id: null,
      to_email: SIM,
      status: "pending",
      scheduled_for: past,
      payload: { subject: "safety test", html: "<p>safety test</p>", campaignId, contact: { email: SIM, buyerId: null, recipientId: null } },
    })
  }
  await sbInsert("email_campaign_queue", jobs)
  info("3 pending jobs queued")

  // 4. Fire the real breaker
  step("Trigger the real drain (POST /api/email-campaigns/process)")
  const drain = await appPost("/api/email-campaigns/process", { limit: 50 })
  if (!drain.ok) die(`process endpoint returned ${drain.status}: ${drain.text}`)
  pass(`drain ran (${drain.text.slice(0, 120)})`)

  // 5. Verify the pause
  step("Verify PAUSE")
  const [c1] = await sbSelect("campaigns", `id=eq.${campaignId}&select=status`)
  c1?.status === "paused_by_safety"
    ? pass(`campaign status = paused_by_safety`)
    : fail(`expected paused_by_safety, got "${c1?.status}"`)

  const q1 = await sbSelect("email_campaign_queue", `campaign_id=eq.${campaignId}&select=status`)
  const pausedJobs = q1.filter((j) => j.status === "paused").length
  const sentJobs = q1.filter((j) => j.status === "sent").length
  pausedJobs === q1.length && q1.length > 0
    ? pass(`all ${q1.length} queue jobs moved to 'paused' (0 sent)`)
    : fail(`expected all jobs paused, got ${pausedJobs} paused / ${sentJobs} sent of ${q1.length}`)

  const notes = await sbSelect("notifications", `type=eq.campaign_paused_safety&select=metadata&order=created_at.desc&limit=20`)
  notes.some((n) => n?.metadata?.campaignId === campaignId)
    ? pass(`pause notification fired`)
    : fail(`no campaign_paused_safety notification found for this campaign`)

  // 6. Fix the list, then resume
  step("Simulate fixing the list (clear bounces) + RESUME")
  await sbPatch("campaign_recipients", `campaign_id=eq.${campaignId}&bounce_type=eq.Permanent`, { bounce_type: null, bounced_at: null, status: "sent" })
  info("cleared the 8 fake bounces (hard-bounce rate now 0%)")
  const resume = await appPost(`/api/campaigns/${campaignId}/resume`, {})
  resume.ok ? pass(`resume endpoint ok (${resume.text.slice(0, 120)})`) : fail(`resume returned ${resume.status}: ${resume.text}`)

  // 7. Verify recovery
  step("Verify RESUME")
  const [c2] = await sbSelect("campaigns", `id=eq.${campaignId}&select=status`)
  c2?.status !== "paused_by_safety"
    ? pass(`campaign no longer paused (status = "${c2?.status}")`)
    : fail(`campaign still paused_by_safety after resume`)
  const q2 = await sbSelect("email_campaign_queue", `campaign_id=eq.${campaignId}&select=status`)
  const stillPaused = q2.filter((j) => j.status === "paused").length
  stillPaused === 0 ? pass(`no jobs left in 'paused'`) : fail(`${stillPaused} jobs still 'paused' after resume`)
}

main()
  .catch((e) => { console.error(e); fails++ })
  .finally(async () => {
    await cleanup().catch(() => {})
    console.log(`\n${C.b}Result: ${passes} passed, ${fails} failed${C.x}`)
    process.exit(fails ? 1 : 0)
  })
