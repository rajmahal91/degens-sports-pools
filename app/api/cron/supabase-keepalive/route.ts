import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get('authorization') === `Bearer ${secret}`;
  return request.headers.get('user-agent')?.includes('vercel-cron/1.0') === true;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron/supabase-keepalive] database check failed', error);
    return NextResponse.json(
      { error: 'Supabase database check failed.' },
      { status: 503 },
    );
  }
}
