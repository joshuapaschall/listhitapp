export function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin should never run in the browser")
  }
}
