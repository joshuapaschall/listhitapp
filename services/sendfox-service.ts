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

export interface SendFoxList {
  id: number
  name: string
  contact_count: number
  created_at: string
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
    const { data: groups } = await supabaseAdmin
      .from("groups")
      .select("id,name,sendfox_list_id")
      .in("sendfox_list_id", ids)
    const groupMap = new Map<number, { id: string; name: string }>()
    for (const g of groups || []) {
      if (g.sendfox_list_id) {
        groupMap.set(g.sendfox_list_id, { id: g.id, name: g.name })
      }
    }
    return lists.map((l: any) => ({
      id: l.id,
      name: l.name,
      contact_count: l.contact_count || 0,
      created_at: l.created_at,
      group: groupMap.get(l.id) || null,
    })) as SendFoxList[]
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

export async function sendEmail(to: string, subject: string, html: string) {
  return sendfoxRequest("/content/emails", {
    method: "POST",
    body: JSON.stringify({
      contacts: [to],
      subject,
      html,
      do_not_send: false,
    }),
  })
}

export async function getEmail(id: string) {
  return sendfoxRequest(`/emails/${id}`)
}

export async function unsubscribe(email: string) {
  return sendfoxRequest("/unsubscribe", {
    method: "PATCH",
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
  fetchUnsubscribed,
  sendEmail,
  getEmail,
  unsubscribe,
  deleteList,
  deleteContact,
  findContactByEmail,
  removeContactFromList,
}
