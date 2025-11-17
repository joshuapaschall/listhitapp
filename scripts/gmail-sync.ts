import { listThreads } from "@/services/gmail-api"

export async function syncGmailThreads(
  userId: string,
  maxResults = 100,
  folder = "inbox",
) {
  const threads = await listThreads(userId, maxResults, folder)
  return threads.length
}

async function main() {
  const userId = process.argv[2]
  const max = parseInt(process.argv[3] || "100", 10)
  const folder = process.argv[4] || "inbox"
  if (!userId) throw new Error("userId required")
  const count = await syncGmailThreads(userId, max, folder)
  console.log(`Synced ${count} threads`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
