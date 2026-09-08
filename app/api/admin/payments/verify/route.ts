import { NextResponse } from 'next/server';
import { requireCommissioner } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireCommissioner();
    const { paymentId } = await request.json();
    const { data: before } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!before) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('payments').update({ status: 'PAID', verified_by: user.id, verified_at: now }).eq('id', paymentId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('entries').update({ payment_status: 'PAID' }).eq('id', before.entry_id);
    await supabase.from('commissioner_audit_log').insert({ commissioner_id: user.id, action: 'VERIFY_PAYMENT', entity_type: 'payment', entity_id: paymentId, payload: { before, after: data } });
    return NextResponse.json({ payment: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message === 'FORBIDDEN' ? 403 : 401 });
  }
}
