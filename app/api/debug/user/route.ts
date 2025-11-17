// app/api/debug/user/route.ts
import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

type Body = {
  email: string;
  password?: string;
  confirmEmail?: boolean;
  name?: string;
};

function admin() {
  return createAdmin(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

function adminHeaders() {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
  };
}

async function listUserByEmail(email: string) {
  const resp = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: adminHeaders(), cache: 'no-store' }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`admin list failed: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  const user =
    Array.isArray(json?.users) ? json.users[0] :
    json?.users?.[0] ?? json?.[0] ?? null;

  return user;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });

    // touch the client (kept from earlier version, but not strictly required)
    admin();

    const user = await listUserByEmail(email);
    if (!user) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const confirmEmail = body.confirmEmail ?? true;
    const name = body.name || null;

    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
    if (!password || password.length < 12) {
      return NextResponse.json({ ok: false, error: 'password required (min 12 chars)' }, { status: 400 });
    }

    // 1) See if user already exists
    const existing = await listUserByEmail(email);

    if (existing?.id) {
      // 2) Update password + confirm + optional name
      const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: 'PATCH',
        headers: {
          ...adminHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          email_confirm: confirmEmail,
          ban_duration: 'none',
          user_metadata: name ? { ...(existing.user_metadata ?? {}), name } : existing.user_metadata,
        }),
      });

      if (!upd.ok) {
        const text = await upd.text();
        return NextResponse.json({ ok: false, error: `admin update failed: ${upd.status} ${text}` }, { status: 500 });
      }

      const user = await upd.json();
      return NextResponse.json({ ok: true, mode: 'updated', user });
    }

    // 3) Create new confirmed user
    const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        ...adminHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: confirmEmail,
        user_metadata: name ? { name } : undefined,
        ban_duration: 'none',
      }),
    });

    if (!create.ok) {
      const text = await create.text();

      // 3a) If duplicate (23505), repair via update instead of failing
      if (text.includes('"code":"23505"') || text.toLowerCase().includes('already exists')) {
        const again = await listUserByEmail(email);
        if (!again?.id) {
          return NextResponse.json({ ok: false, error: 'user exists but cannot be retrieved' }, { status: 500 });
        }

        const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${again.id}`, {
          method: 'PATCH',
          headers: {
            ...adminHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password,
            email_confirm: confirmEmail,
            ban_duration: 'none',
            user_metadata: name ? { ...(again.user_metadata ?? {}), name } : again.user_metadata,
          }),
        });

        if (!upd.ok) {
          const t = await upd.text();
          return NextResponse.json({ ok: false, error: `admin update failed: ${upd.status} ${t}` }, { status: 500 });
        }

        const user = await upd.json();
        return NextResponse.json({ ok: true, mode: 'repaired', user });
      }

      return NextResponse.json({ ok: false, error: `admin create failed: ${create.status} ${text}` }, { status: 500 });
    }

    const user = await create.json();
    return NextResponse.json({ ok: true, mode: 'created', user });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
