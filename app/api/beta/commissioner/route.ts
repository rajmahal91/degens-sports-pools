import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const { user } = await requireUser();
    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ is_commissioner: true }).eq('id', user.id);
    if (error) throw error;
    console.info('[api/commissioner] access enabled', { userId: user.id });
    return NextResponse.json({ ok: true, isCommissioner: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : 400 });
  }
}
