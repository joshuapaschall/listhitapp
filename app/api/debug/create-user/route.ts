import { NextResponse } from 'next/server'

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!  // make sure this is set in Vercel

  const resp = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'joshsellshouses@gmail.com',
      password: 'SetAStrongPasswordHere123!',
      email_confirm: true,
      user_metadata: { name: 'Josh Paschall' },
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return NextResponse.json({ error: text }, { status: resp.status })
  }

  const json = await resp.json()
  return NextResponse.json(json)
}
