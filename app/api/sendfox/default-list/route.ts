export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({
    listId: process.env.SENDFOX_DEFAULT_LIST_ID ? Number(process.env.SENDFOX_DEFAULT_LIST_ID) : null,
  })
}
