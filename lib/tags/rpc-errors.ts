// Shared mapping from the cascade functions' RAISE EXCEPTION messages to HTTP
// responses, so every tag route answers identically.

import { NextResponse } from "next/server"

export function tagRpcErrorResponse(error: unknown, context: Record<string, unknown>): NextResponse {
  const message = (error as { message?: string })?.message ?? ""

  if (message.includes("protected_tag")) {
    return NextResponse.json(
      { error: "System tags can't be renamed, merged, or deleted." },
      { status: 403 },
    )
  }
  if (message.includes("name_taken")) {
    return NextResponse.json(
      { error: "A tag with that name already exists — use Merge instead." },
      { status: 409 },
    )
  }
  if (message.includes("invalid_name")) {
    return NextResponse.json({ error: "Enter a tag name between 1 and 60 characters." }, { status: 400 })
  }
  if (message.includes("same_tag")) {
    return NextResponse.json({ error: "Pick a different tag to merge into." }, { status: 400 })
  }
  if (message.includes("tag_not_found")) {
    return NextResponse.json({ error: "That tag no longer exists." }, { status: 404 })
  }

  console.error("[tags] cascade failed", { ...context, error })
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
}
