import type { NegativeKeyword } from "@/lib/supabase"

export interface KeywordInput {
  keyword: string
  matchType: "exact" | "phrase"
  action: "hide" | "dnc"
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as any)?.error || "Request failed")
  }
  return data
}

export class KeywordService {
  static async listKeywords(): Promise<NegativeKeyword[]> {
    const res = await fetch("/api/negative-keywords", { cache: "no-store" })
    return (await readJson(res)) as NegativeKeyword[]
  }

  static async getKeyword(id: string): Promise<NegativeKeyword | null> {
    const list = await this.listKeywords()
    return list.find((k) => k.id === id) ?? null
  }

  static async addKeyword(input: KeywordInput): Promise<NegativeKeyword> {
    const res = await fetch("/api/negative-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return (await readJson(res)) as NegativeKeyword
  }

  static async updateKeyword(id: string, input: Partial<KeywordInput>): Promise<NegativeKeyword> {
    const res = await fetch(`/api/negative-keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return (await readJson(res)) as NegativeKeyword
  }

  static async deleteKeyword(id: string): Promise<void> {
    const res = await fetch(`/api/negative-keywords/${id}`, { method: "DELETE" })
    await readJson(res)
  }
}
