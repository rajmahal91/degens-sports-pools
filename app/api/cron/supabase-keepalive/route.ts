import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const isVercelCron = userAgent.startsWith('vercel-cron/');

  return Boolean(
    (secret && authorization === `Bearer ${secret}`) ||
      (!secret && isVercelCron),
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Supabase public credentials are not configured.' },
      { status: 503 },
    );
  }

  try {
    // Use the public REST API so this counts as normal database activity on
    // Supabase free projects. The query is read-only and RLS-safe.
    const response = await fetch(
      `${url.replace(/\\/$/, '')}/rest/v1/profiles?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase REST returned ${response.status}: ${detail.slice(0, 200)}`);
    }

    return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/supabase-keepalive] failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Keepalive failed.' },
      { status: 502 },
    );
  }
}
