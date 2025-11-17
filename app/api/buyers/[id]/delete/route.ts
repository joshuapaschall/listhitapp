import { NextRequest } from "next/server"
import { POST as bulkDelete } from "../../bulk-delete/route"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = { ids: [params.id] }
  const wrapped = new NextRequest(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return bulkDelete(wrapped)
}
