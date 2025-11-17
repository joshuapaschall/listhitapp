export async function DELETE() {
  return new Response(
    JSON.stringify({
      error:
        "SendFox does not support DELETE; use POST /api/sendfox/contact with Deleted list",
    }),
    { status: 405 },
  )
}
