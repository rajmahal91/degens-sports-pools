import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

const POOLS = [
  { id: '00000000-0000-0000-0000-000000000101', suffix: 'Survivor', paid: false },
  { id: '00000000-0000-0000-0000-000000000102', suffix: "Pick'em", paid: true },
  { id: '00000000-0000-0000-0000-000000000103', suffix: 'Playoff Fantasy', paid: false },
];

export async function POST() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
    const base = (profile?.display_name || user.email?.split('@')[0] || 'Beta Player').slice(0, 40);

    const { data: existing } = await supabase.from('entries').select('pool_id').eq('user_id', user.id);
    const existingPools = new Set((existing || []).map((e:any) => e.pool_id));
    const created:any[] = [];

    for (const item of POOLS) {
      if (existingPools.has(item.id)) continue;
      const { data, error } = await supabase.from('entries').insert({
        pool_id: item.id,
        user_id: user.id,
        entry_name: `${base} · ${item.suffix}`,
        entry_status: 'ACTIVE',
        payment_status: item.paid ? 'PAID' : 'UNPAID',
      }).select().single();
      if (error) throw error;
      created.push(data);
    }

    return NextResponse.json({ ok: true, created, message: created.length ? `Created ${created.length} beta entries.` : 'Beta entries already exist.' });
  } catch (e) {
    const message = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Beta setup failed');
    console.error('[api/beta/setup] failed', { message });
    return NextResponse.json({ error: message }, { status: message === 'UNAUTHENTICATED' ? 401 : 400 });
  }
}
