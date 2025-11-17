import { NextResponse } from "next/server";

export async function GET() {
  const u = process.env.SUPABASE_URL || "";
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = (s: string) =>
    s.replace(/^https?:\/\//, "").replace(/\.supabase\.co.*/, "");

  return NextResponse.json({
    serverProjectRef: ref(u),
    clientProjectRef: ref(pub)
  });
}
