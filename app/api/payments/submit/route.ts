import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { poolId, entryId, method, reference } = await request.json();
    const { data: entry } = await supabase.from('entries').select('id,user_id,pool_id').eq('id', entryId).single();
    if (!entry || entry.user_id !== user.id || entry.pool_id !== poolId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data: pool } = await supabase.from('pools').select('entry_fee_cents,currency').eq('id', poolId).single();
    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    if (!['ETRANSFER','CASH'].includes(method)) return NextResponse.json({ error: 'This payment method is not enabled.' }, { status: 400 });
    const { data, error } = await supabase.from('payments').insert({ user_id: user.id, entry_id: entryId, amount_cents: pool.entry_fee_cents, currency: pool.currency, method, status: 'PENDING', reference: reference || null }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('entries').update({ payment_status: 'PENDING' }).eq('id', entryId);
    return NextResponse.json({ payment: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 401 });
  }
}
