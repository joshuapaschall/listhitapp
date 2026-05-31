export type UserMergeContext = {
  myFirstName: string
  myLastName: string
}

type ProfileClient = {
  from: (table: string) => any
}

export function splitName(full: string | null): { first: string; last: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: "", last: "" }
  return {
    first: parts[0] || "",
    last: parts.slice(1).join(" "),
  }
}

export async function getUserMergeContext(
  client: ProfileClient,
  userId: string | null | undefined,
): Promise<UserMergeContext> {
  if (!userId) return { myFirstName: "", myLastName: "" }

  const { data, error } = await client
    .from("profiles")
    .select("full_name,display_name")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return { myFirstName: "", myLastName: "" }

  const name = data.full_name || data.display_name || ""
  const { first, last } = splitName(name)
  return { myFirstName: first, myLastName: last }
}
