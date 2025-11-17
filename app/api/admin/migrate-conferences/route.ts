import { NextResponse } from "next/server"

const RETIRED_MESSAGE = "This endpoint no longer performs migrations. Run scripts/01-schema.sql to manage the public.active_conferences schema across environments. The legacy SQL is archived at migrations/archive/036-active-conferences.sql for historical reference.";

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
