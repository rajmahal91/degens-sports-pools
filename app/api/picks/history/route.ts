import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Could not load pick history.';
  const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

async function canManagePool(supabase: any, userId: string, pool: any) {
  const [{ data: organization }, { data: orgMember }, { data: leagueMember }] = await Promise.all([
    supabase.from('organizations').select('owner_user_id').eq('id', pool.organization_id).maybeSingle(),
    supabase.from('organization_members').select('role,status').eq('organization_id', pool.organization_id).eq('user_id', userId).maybeSingle(),
    supabase.from('league_members').select('role,status').eq('pool_id', pool.id).eq('user_id', userId).maybeSingle(),
  ]);
  return organization?.owner_user_id === userId ||
    (orgMember?.status === 'ACTIVE' && ['OWNER', 'ADMIN', 'COMMISSIONER'].includes(orgMember.role)) ||
    (leagueMember?.status === 'ACTIVE' && ['COMMISSIONER', 'CO_COMMISSIONER'].includes(leagueMember.role));
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const params = new URL(request.url).searchParams;
    const entryId = params.get('entryId');
    const poolId = params.get('poolId');
    if (!entryId && !poolId) return NextResponse.json({ error: 'Choose an entry or pool.' }, { status: 400 });

    let targetPoolId = poolId;
    let entryIds: string[] = [];
    if (entryId) {
      const { data: entry } = await supabase.from('entries').select('id,user_id,pool_id').eq('id', entryId).maybeSingle();
      if (!entry) return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
      const { data: pool } = await supabase.from('pools').select('id,organization_id').eq('id', entry.pool_id).single();
      const allowed = entry.user_id === user.id || (pool && await canManagePool(supabase, user.id, pool));
      if (!allowed) throw new Error('FORBIDDEN');
      targetPoolId = entry.pool_id;
      entryIds = [entry.id];
    } else {
      const { data: pool } = await supabase.from('pools').select('id,organization_id').eq('id', poolId).maybeSingle();
      if (!pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 });
      const { data: ownEntries } = await supabase.from('entries').select('id').eq('pool_id', pool.id).eq('user_id', user.id);
      const allowedToManage = await canManagePool(supabase, user.id, pool);
      if (!allowedToManage && !ownEntries?.length) throw new Error('FORBIDDEN');
      entryIds = allowedToManage
        ? ((await supabase.from('entries').select('id').eq('pool_id', pool.id)).data || []).map((entry: any) => entry.id)
        : (ownEntries || []).map((entry: any) => entry.id);
    }

    const admin = createAdminClient();
    let query = admin
      .from('pick_receipts')
      .select('*')
      .eq('pool_id', targetPoolId)
      .order('recorded_at', { ascending: false })
      .limit(200);
    if (entryIds.length) query = query.in('entry_id', entryIds);
    const { data, error } = await query;
    if (error) throw error;
    const receiptRows = data || [];
    const receiptEntryIds = [...new Set(receiptRows.map((receipt: any) => receipt.entry_id))];
    const { data: receiptEntries } = receiptEntryIds.length
      ? await admin.from('entries').select('id,entry_name').in('id', receiptEntryIds)
      : { data: [] };
    const entryNames = new Map((receiptEntries || []).map((entry: any) => [entry.id, entry.entry_name]));
    return NextResponse.json({
      receipts: receiptRows.map((receipt: any) => ({ ...receipt, entry_name: entryNames.get(receipt.entry_id) || 'Entry' })),
    });
  } catch (error) {
    return failure(error);
  }
}
