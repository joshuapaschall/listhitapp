import { NextResponse } from "next/server"

const RETIRED_MESSAGE = "This helper endpoint has been retired. Run scripts/01-schema.sql to provision public.active_conferences, indexes, RLS policies, grants, and realtime publication. Historical SQL lives at migrations/archive/036-active-conferences.sql if you need the original file.";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: RETIRED_MESSAGE,
      migration: "scripts/01-schema.sql"
    },
    { status: 410 }
  );
}
