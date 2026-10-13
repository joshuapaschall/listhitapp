import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { formatPhoneE164, isValidPhone } from "@/lib/dedup-utils"
import { resolveComplianceUrls } from "@/lib/org-twilio/compliance-urls"
import { advanceRegistration } from "@/lib/org-twilio/engine"
import { loadRegistrationData, validateRegistration } from "@/lib/org-twilio/inputs"
import type { CustomerIssue } from "@/lib/org-twilio/issues"
import { getOrgTwilio, upsertOrgTwilio } from "@/lib/org-twilio/service"
import {
  BRAND_TYPE_SOLE_PROPRIETOR,
  BRAND_TYPE_STANDARD,
  REP_JOB_POSITIONS,
  isValidBusinessType,
  normalizeBusinessType,
  type BrandType,
} from "@/lib/org-twilio/twilio-attributes"
import { supabaseAdmin } from "@/lib/supabase"
import { requireRegistrationContext, statusResponse } from "../_shared"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const WEBSITE_ISSUE: CustomerIssue = {
  field: "website",
  message: "Publish your ListHit website, or add your website with links to its privacy policy and terms.",
  fixable: true,
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

const unprocessable = (issues: CustomerIssue[]) => NextResponse.json({ issues }, { status: 422 })

// Submit the org's texting registration. Validates everything first (422 with
// customer issues), records the request, then hands off to the engine. Idempotent:
// once submitted, a repeat returns the current status and changes nothing.
export async function POST(request: Request) {
  const ctx = await requireRegistrationContext()
  if (ctx instanceof NextResponse) return ctx
  const { orgId } = ctx

  const body = await request.json().catch(() => null)
  const brandType = body?.brandType as BrandType | undefined
  if (brandType !== BRAND_TYPE_STANDARD && brandType !== BRAND_TYPE_SOLE_PROPRIETOR) {
    return NextResponse.json({ error: "brandType must be STANDARD or SOLE_PROPRIETOR." }, { status: 400 })
  }

  try {
    const existing = await getOrgTwilio(orgId)
    if (existing?.submitted_at && existing.setup_stage !== "not_started") {
      return await statusResponse(orgId)
    }

    const businessTypeRaw = str(body?.businessType)
    const repTitle = str(body?.repTitle)
    const repJobPosition = str(body?.repJobPosition)
    const repPhoneRaw = str(body?.repPhone)
    const desiredPhone = str(body?.desiredPhoneNumber)
    const areaCode = str(body?.areaCode)

    const issues: CustomerIssue[] = []
    const repPhone = isValidPhone(repPhoneRaw) ? formatPhoneE164(repPhoneRaw) : null
    if (!repPhone) issues.push({ field: "rep", message: "Add a valid US mobile number for your authorized representative.", fixable: true })
    if (repJobPosition && !(REP_JOB_POSITIONS as readonly string[]).includes(repJobPosition)) {
      issues.push({ field: "rep", message: "Choose a job position from the list.", fixable: true })
    }
    if (businessTypeRaw && !isValidBusinessType(businessTypeRaw)) {
      issues.push({ field: "business_type", message: "Choose your business type (LLC, corporation, partnership, co-operative or non-profit).", fixable: true })
    }
    if (desiredPhone && !isValidPhone(desiredPhone)) {
      issues.push({ field: "other", message: "Pick a phone number from the list.", fixable: true })
    }
    if (areaCode && !/^\d{3}$/.test(areaCode)) {
      issues.push({ field: "other", message: "Enter a 3-digit area code.", fixable: true })
    }
    if (issues.length) return unprocessable(issues)

    // Save the rep fields (and a normalized business type) on the org's own row.
    const { error: bvErr } = await supabaseAdmin
      .from("business_verification")
      .update({
        rep_phone: repPhone,
        rep_title: repTitle || null,
        rep_job_position: repJobPosition || null,
        ...(businessTypeRaw ? { business_type: normalizeBusinessType(businessTypeRaw) } : {}),
      })
      .eq("org_id", orgId)
    if (bvErr) return apiError(bvErr, 500)

    // Everything the engine will send, validated before any Twilio call.
    const data = await loadRegistrationData(orgId)
    if (!data.bv) {
      return unprocessable([{ field: "legal_name", message: "Complete your business details first.", fixable: true }])
    }
    const einDigits = str(data.bv.ein).replace(/[^0-9]/g, "")
    if (brandType === BRAND_TYPE_STANDARD && einDigits.length !== 9) {
      return unprocessable([{ field: "ein", message: "Registering as a business needs your 9-digit EIN. Without one, register as a sole proprietor.", fixable: true }])
    }
    if (brandType === BRAND_TYPE_SOLE_PROPRIETOR && einDigits.length > 0) {
      return unprocessable([{ field: "ein", message: "Sole proprietor registration is only for businesses without an EIN. Register as a business instead.", fixable: true }])
    }

    const urls = await resolveComplianceUrls(orgId)
    if ("error" in urls) return unprocessable([WEBSITE_ISSUE])

    const validation = validateRegistration(data, brandType, urls.websiteUrl)
    if (validation.length) return unprocessable(validation)

    await upsertOrgTwilio(orgId, {
      brand_type: brandType,
      desired_phone_number: desiredPhone ? formatPhoneE164(desiredPhone) : null,
      desired_area_code: areaCode || null,
      ...(existing?.submitted_at ? {} : { submitted_at: new Date().toISOString() }),
      setup_stage: "submitting",
      customer_issues: null,
    })

    await advanceRegistration(orgId, { reason: "submit" })
    return await statusResponse(orgId)
  } catch (err) {
    return apiError(err, 500)
  }
}
