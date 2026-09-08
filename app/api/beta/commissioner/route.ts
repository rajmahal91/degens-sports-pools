import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const configured = process.env.BETA_COMMISSIONER_CODE;
    if (!configured) return NextResponse.json({ error: 'BETA_COMMISSIONER_CODE is not configured.' }, { status: 503 });
    const { code } = await request.json();
    if (!code || code !== configured) return NextResponse.json({ error: 'Invalid commissioner code.' }, { status: 403 });
    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ is_commissioner: true }).eq('id', user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : 400 });
  }
}
