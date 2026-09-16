import { createAdminClient } from '@/lib/supabase/admin';

export type PickReceiptType = 'SURVIVOR' | 'PICKEM' | 'PLAYOFF_FANTASY';

export async function recordPickReceipt(input: {
  userId: string;
  entryId: string;
  poolId: string;
  pickType: PickReceiptType;
  pickKey: string;
  action: 'SUBMITTED' | 'CHANGED';
  beforeState?: unknown;
  afterState: unknown;
  submittedAt?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('pick_receipts')
    .insert({
      user_id: input.userId,
      entry_id: input.entryId,
      pool_id: input.poolId,
      pick_type: input.pickType,
      pick_key: input.pickKey,
      action: input.action,
      before_state: input.beforeState ?? null,
      after_state: input.afterState,
      submitted_at: input.submittedAt || new Date().toISOString(),
      source: 'PLAYER',
    })
    .select('id,entry_id,pool_id,pick_type,pick_key,action,after_state,submitted_at,recorded_at')
    .single();
  if (error) throw error;
  return data;
}
