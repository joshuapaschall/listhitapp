import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token || token !== process.env.ADMIN_TASKS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const u = process.env.SUPABASE_URL || "";
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = (s: string) =>
    s.replace(/^https?:\/\//, "").replace(/\.supabase\.co.*/, "");

  return NextResponse.json({
    serverProjectRef: ref(u),
    clientProjectRef: ref(pub)
  });
}
