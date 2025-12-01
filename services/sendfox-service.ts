import { createLogger } from "@/lib/logger"
import { supabaseAdmin } from "@/lib/supabase"
import {
  ensureSendfoxContextFresh,
  getDefaultSendfoxContext,
  getSendfoxAuthContext,
  refreshSendfoxToken,
} from "./sendfox-auth"

const log = createLogger("sendfox-service")

const API_BASE = "https://api.sendfox.com"
const DELETED_LIST_ID = Number(process.env.SENDFOX_DELETED_LIST_ID)

export interface SendFoxList {
  id: number
  name: string
  contact_count: number
  created_at: string
  last_sync_status?: "success" | "error" | "dry_run"
  last_sync_message?: string | null
  last_sync_at?: string | null
  pending_mismatches?: number
  group?: { id: string; name: string } | null
}

export type SendFoxErrorType =
  | "unauthorized"
  | "payment_required"
  | "forbidden"
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "unknown"

export class SendFoxError extends Error {
  status: number
  type: SendFoxErrorType
  details?: string
  constructor(status: number, type: SendFoxErrorType, message: string, details?: string) {
    super(message)
    this.status = status
    this.type = type
    this.details = details
  }
}

export function createSendFoxError(status: number, text: string) {
  const map: Record<number, { type: SendFoxErrorType; message: string }> = {
    400: { type: "bad_request", message: "Bad Request" },
    401: { type: "unauthorized", message: "Unauthorized" },
    402: { type: "payment_required", message: "Payment Required" },
    403: { type: "forbidden", message: "Forbidden" },
    404: { type: "not_found", message: "Not Found" },
    429: { type: "rate_limited", message: "Too Many Requests" },
  }
  const info =
    map[status] ||
    (status >= 500
      ? { type: "server_error" as const, message: "Server Error" }
      : { type: "unknown" as const, message: `Error ${status}` })
  return new SendFoxError(status, info.type, info.message, text)
}

async function resolveAuth(allowEnvFallback: boolean) {
  const context = getSendfoxAuthContext()
  if (context) {
    const fresh = await ensureSendfoxContextFresh(context)
    return { token: fresh.accessToken, context: fresh }
  }
  if (allowEnvFallback) {
    const fallback = getDefaultSendfoxContext()
    if (fallback) {
      return { token: fallback.accessToken, context: fallback }
    }
  }
  throw new SendFoxError(401, "unauthorized", "SendFox API token not configured")
}

async function sendfoxRequest(
  path: string,
  options: RequestInit = {},
  opts: { allowEnvFallback?: boolean } = {},
) {
  const allowEnvFallback = opts.allowEnvFallback ?? true
  const RETRY_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 1000
  let attempt = 0
  let lastErr: any
  let auth = await resolveAuth(allowEnvFallback)

  while (attempt < 2) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          ...(options.headers || {}),
        },
      })

      const text = await res.text()
      if (res.status === 401 && auth.context?.refreshToken) {
        try {
          const refreshed = await refreshSendfoxToken(
            auth.context.refreshToken,
            auth.context.integrationId,
            auth.context.userId,
          )
          auth = {
            token: refreshed.access_token,
            context: {
              ...(auth.context || {}),
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token,
              expiresAt: refreshed.expires_at ?? undefined,
            },
          }
          attempt += 1
          continue
        } catch (refreshErr) {
          lastErr = refreshErr
          break
        }
      }

      if (!res.ok) {
        const err = createSendFoxError(res.status, text)
        throw err
      }

      try {
        return text ? JSON.parse(text) : null
      } catch {
        return text as any
      }
    } catch (err: any) {
      lastErr = err
      log(attempt === 1 ? "error" : "warn", "SendFox API request failed", {
        path,
        body: options.body,
        status: err?.status,
        errorType: err?.type,
        details: err?.details,
        message: err?.message,
        attempt: attempt + 1,
      })
      if (attempt === 1) break
      attempt += 1
      if (RETRY_DELAY_MS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
      auth = await resolveAuth(allowEnvFallback)
    }
  }
  throw lastErr
}

export async function upsertContact(
  email: string,
  firstName?: string,
  lastName?: string,
  lists: number[] = [],
  tags?: string[],
  ip_address?: string,
) {
  const body: any = { email }
  if (firstName) body.first_name = firstName
  if (lastName) body.last_name = lastName
  if (lists.length) body.lists = lists
  if (tags && tags.length) body.tags = tags
  if (ip_address) body.ip_address = ip_address

  try {
    return await sendfoxRequest("/contacts", {
      method: "POST",
      body: JSON.stringify(body),
    })
  } catch (err: any) {
    if (
      err instanceof SendFoxError &&
      err.status === 400 &&
      err.details?.toLowerCase().includes("exists")
    ) {
      log("warn", "Contact already exists, reusing", { email, details: err.details })
      const existing = await findContactByEmail(email)
      if (existing) return existing
    }
    log("error", "Failed to upsert contact", { email, error: err })
    throw err
  }
}

export async function addContactToList(
  listId: number,
  contact: { email: string; first_name?: string; last_name?: string },
) {
  try {
    return await sendfoxRequest(`/contacts`, {
      method: "POST",
      body: JSON.stringify({
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        lists: [listId],
      }),
    })
  } catch (err: any) {
    if (
      err instanceof SendFoxError &&
      err.status === 400 &&
      err.details?.toLowerCase().includes("exists")
    ) {
      log("warn", "Contact already exists", { listId, email: contact.email })
      return findContactByEmail(contact.email)
    }
    log("error", "Failed to add contact to SendFox list", {
      listId,
      email: contact.email,
      error: err,
    })
    throw err
  }
}

export async function findContactByEmail(email: string) {
  const data = await sendfoxRequest(`/contacts?email=${encodeURIComponent(email)}`)
  if (!data) return null
  if (Array.isArray(data)) return data[0] || null
  if (Array.isArray(data.data)) return data.data[0] || null
  return data
}

export async function createList(name: string) {
  try {
    const resp = await sendfoxRequest("/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
    const list = resp?.data ? resp.data : resp
    return list
  } catch (err: any) {
    log("error", "Failed to create SendFox list", { name, error: err })
    throw err
  }
}

export async function deleteContact(contactId: number) {
  return sendfoxRequest(`/contacts/${contactId}`, { method: "DELETE" })
}

export async function removeContactFromList(listId: number, contactId: number) {
  return sendfoxRequest(`/lists/${listId}/contacts/${contactId}`, {
    method: "DELETE",
  })
}

export async function getOrCreateList(name: string) {
  const listsResp = (await sendfoxRequest("/lists")) as any
  const lists = Array.isArray(listsResp?.data)
    ? listsResp.data
    : Array.isArray(listsResp)
      ? listsResp
      : []
  const existing = lists.find((l: any) => l.name === name)
  if (existing) return existing

  try {
    return await sendfoxRequest("/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
  } catch (err: any) {
    if (
      err instanceof SendFoxError &&
      err.status === 400 &&
      err.details?.toLowerCase().includes("exists")
    ) {
      log("warn", "List already exists, reusing", { name })
      const resp = (await sendfoxRequest("/lists")) as any
      const lists = Array.isArray(resp?.data)
        ? resp.data
        : Array.isArray(resp)
          ? resp
          : []
      const found = lists.find((l: any) => l.name === name)
      if (found) return found
    }
    log("error", "Failed to create list", { name, error: err })
    throw err
  }
}

export async function fetchLists() {
  try {
    const resp = (await sendfoxRequest("/lists", {
      headers: { Accept: "application/json" },
    })) as any
    const lists = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : []
    if (lists.length === 0) return []
    const ids = lists.map((l: any) => l.id)

    let groups: any[] = []
    let logs: any[] = []
    let mismatches: any[] = []
    if (supabaseAdmin) {
      const [{ data: groupRows }, { data: logRows }, { data: mismatchRows }] = await Promise.all([
        supabaseAdmin.from("groups").select("id,name,sendfox_list_id").in("sendfox_list_id", ids),
        supabaseAdmin
          .from("sendfox_list_sync_logs")
          .select("list_id,status,error_message,mismatches,applied,created_at")
          .in("list_id", ids)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("sendfox_list_mismatches")
          .select("list_id,resolved")
          .in("list_id", ids),
      ])
      groups = groupRows || []
      logs = logRows || []
      mismatches = mismatchRows || []
    }

    const groupMap = new Map<number, { id: string; name: string }>()
    for (const g of groups || []) {
      if (g.sendfox_list_id) {
        groupMap.set(g.sendfox_list_id, { id: g.id, name: g.name })
      }
    }

    const latestLogMap = new Map<number, any>()
    for (const l of logs || []) {
      if (!latestLogMap.has(l.list_id)) latestLogMap.set(l.list_id, l)
    }

    const mismatchCount = new Map<number, number>()
    for (const m of mismatches || []) {
      if (!m.resolved) {
        mismatchCount.set(m.list_id, (mismatchCount.get(m.list_id) || 0) + 1)
      }
    }

    return lists.map((l: any) => {
      const latest = latestLogMap.get(l.id)
      return {
        id: l.id,
        name: l.name,
        contact_count: l.contact_count || 0,
        created_at: l.created_at,
        group: groupMap.get(l.id) || null,
        last_sync_status: latest?.status,
        last_sync_message: latest?.error_message || null,
        last_sync_at: latest?.created_at || null,
        pending_mismatches: mismatchCount.get(l.id) || 0,
      }
    }) as SendFoxList[]
  } catch (err) {
    log("error", "Failed to fetch SendFox lists", { error: err })
    if (typeof window !== "undefined") {
      try {
        const { toast } = await import("sonner")
        toast.error("Failed to fetch SendFox lists")
      } catch {
        // ignore toast errors
      }
    }
    throw err
  }
}

export async function resyncList(listId: number) {
  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id")
    .eq("sendfox_list_id", listId)
    .single()
  if (!group) return { synced: 0 }
  const { data: memberRows } = await supabaseAdmin
    .from("buyer_groups")
    .select("buyer_id")
    .eq("group_id", group.id)
  const buyerIds = (memberRows || []).map((r) => r.buyer_id)
  if (buyerIds.length === 0) return { synced: 0 }
  const { data: buyers } = await supabaseAdmin
    .from("buyers")
    .select("email,fname,lname")
    .in("id", buyerIds)
  let count = 0
  for (const b of buyers || []) {
    if (b.email) {
      await addContactToList(listId, {
        email: b.email,
        first_name: b.fname || undefined,
        last_name: b.lname || undefined,
      })
      count += 1
    }
  }
  return { synced: count }
}

export async function fetchListContacts(listId: number) {
  const all: any[] = []
  let page = 1
  try {
    while (true) {
      const data = (await sendfoxRequest(`/lists/${listId}/contacts?page=${page}`, {
        headers: { Accept: "application/json" },
      })) as any
      if (Array.isArray(data)) {
        all.push(...data)
        if (data.length === 0) break
      } else if (data?.data) {
        all.push(...data.data)
        if (!data.next_page) break
      } else {
        break
      }
      page += 1
    }
  } catch (err) {
    log("error", "Failed to fetch SendFox list contacts", { listId, page, error: err })
    throw err
  }
  return all
}

export async function moveContactToDeletedList(contact: {
  email?: string | null
  first_name?: string | null
  last_name?: string | null
}) {
  if (!DELETED_LIST_ID || Number.isNaN(DELETED_LIST_ID)) {
    throw new Error("SENDFOX_DELETED_LIST_ID missing or invalid")
  }
  if (!contact.email) {
    throw new Error("email required to move contact to Deleted list")
  }
  return addContactToList(DELETED_LIST_ID, {
    email: contact.email,
    first_name: contact.first_name || undefined,
    last_name: contact.last_name || undefined,
  })
}

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase()
}

export async function reconcileSendfoxLists(opts: { listId?: number; dryRun?: boolean } = {}) {
  if (!supabaseAdmin) throw new Error("Supabase admin client not configured")
  const dryRun = opts.dryRun !== false
  const { data: groups } = await supabaseAdmin
    .from("groups")
    .select("id,name,sendfox_list_id")
    .not("sendfox_list_id", "is", null)

  const targets = (groups || []).filter((g) =>
    opts.listId ? Number(g.sendfox_list_id) === Number(opts.listId) : true,
  )

  const results: any[] = []

  for (const group of targets) {
    const listId = Number(group.sendfox_list_id)
    if (!listId) continue
    const result: any = { listId, groupId: group.id, dryRun, mismatches: 0, error: null }
    try {
      const { data: memberRows } = await supabaseAdmin
        .from("buyer_groups")
        .select("buyers!inner(email,fname,lname,sendfox_hidden,sendfox_contact_id)")
        .eq("group_id", group.id)
        .eq("buyers.sendfox_hidden", false)

      const buyers = (memberRows || [])
        .map((r: any) => r.buyers)
        .filter((b: any) => b?.email)
      const buyerMap = new Map<string, any>()
      for (const b of buyers) {
        buyerMap.set(normalizeEmail(b.email), b)
      }

      const contacts = await fetchListContacts(listId)
      const contactMap = new Map<string, any>()
      for (const c of contacts || []) {
        if (c?.email) contactMap.set(normalizeEmail(c.email), c)
      }

      const missingInSendfox = buyers.filter((b: any) => !contactMap.has(normalizeEmail(b.email)))
      const missingInCrm = (contacts || []).filter(
        (c: any) => c?.email && !buyerMap.has(normalizeEmail(c.email)),
      )

      await supabaseAdmin.from("sendfox_list_mismatches").delete().eq("list_id", listId)
      if (missingInSendfox.length || missingInCrm.length) {
        await supabaseAdmin.from("sendfox_list_mismatches").insert([
          ...missingInSendfox.map((b: any) => ({
            list_id: listId,
            group_id: group.id,
            email: b.email,
            issue: "missing_in_sendfox",
            resolved: false,
          })),
          ...missingInCrm.map((c: any) => ({
            list_id: listId,
            group_id: group.id,
            email: c.email,
            issue: "missing_in_crm",
            resolved: false,
          })),
        ])
      }

      if (!dryRun) {
        for (const b of missingInSendfox) {
          await addContactToList(listId, {
            email: b.email,
            first_name: b.fname || undefined,
            last_name: b.lname || undefined,
          })
        }
        for (const c of missingInCrm) {
          try {
            await moveContactToDeletedList({
              email: c.email,
              first_name: c.first_name || undefined,
              last_name: c.last_name || undefined,
            })
          } catch (err) {
            log("warn", "Failed to move contact to Deleted list", { error: err, email: c.email })
          }
          if (c.id) {
            await removeContactFromList(listId, c.id)
          }
        }
      }

      result.mismatches = missingInSendfox.length + missingInCrm.length
      await supabaseAdmin.from("sendfox_list_sync_logs").insert({
        list_id: listId,
        group_id: group.id,
        status: dryRun ? "dry_run" : "success",
        mismatches: result.mismatches,
        applied: !dryRun,
      })
    } catch (err: any) {
      result.error = err?.message || "error"
      await supabaseAdmin.from("sendfox_list_sync_logs").insert({
        list_id: listId,
        group_id: group.id,
        status: "error",
        mismatches: 0,
        applied: false,
        error_message: result.error,
      })
    }
    results.push(result)
  }

  return { runs: results }
}

export async function reconcileSendfoxList(listId: number, opts: { dryRun?: boolean } = {}) {
  return reconcileSendfoxLists({ listId, dryRun: opts.dryRun })
}

export async function fetchUnsubscribed() {
  const all: any[] = []
  let page = 1
  while (true) {
    const data = (await sendfoxRequest(
      `/contacts/unsubscribed?page=${page}`,
    )) as any
    if (Array.isArray(data)) {
      all.push(...data)
      if (data.length === 0) break
    } else if (data?.data) {
      all.push(...data.data)
      if (!data.next_page) break
    } else {
      break
    }
    page += 1
  }
  return all
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  opts: { doNotSend?: boolean } = {},
) {
  const contacts = Array.isArray(to) ? to : [to]
  return sendfoxRequest("/emails", {
    method: "POST",
    body: JSON.stringify({
      contacts,
      subject,
      html,
      do_not_send: opts.doNotSend ?? false,
    }),
  })
}

export async function getEmail(id: string) {
  return sendfoxRequest(`/emails/${id}`)
}

export async function unsubscribe(email: string) {
  return sendfoxRequest("/contacts/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function deleteList(listId: number) {
  return sendfoxRequest(`/lists/${listId}`, { method: "DELETE" })
}

export default {
  upsertContact,
  addContactToList,
  getOrCreateList,
  createList,
  fetchLists,
  resyncList,
  fetchListContacts,
  moveContactToDeletedList,
  reconcileSendfoxLists,
  reconcileSendfoxList,
  fetchUnsubscribed,
  sendEmail,
  getEmail,
  unsubscribe,
  deleteList,
  deleteContact,
  findContactByEmail,
  removeContactFromList,
}
