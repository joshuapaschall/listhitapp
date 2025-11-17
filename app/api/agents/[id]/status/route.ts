export const runtime = "nodejs"
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 },
    )
  }
  try {
    const body = await _req.json()
    const { status } = body as { status?: string }
    if (!status)
      return NextResponse.json({ error: 'Missing status' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('agents')
      .update({ status })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[agents] route error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unexpected server error' },
      { status: 500 },
    )
  }
}
