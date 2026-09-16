import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!error && user) return { supabase, user };
  const authorization=(await headers()).get('authorization');
  const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!token||!url||!key)throw new Error('UNAUTHENTICATED');
  const bearerClient=createSupabaseClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user:bearerUser},error:bearerError}=await bearerClient.auth.getUser(token);
  if(bearerError||!bearerUser)throw new Error('UNAUTHENTICATED');
  return {supabase:bearerClient,user:bearerUser};
}

export async function requireCommissioner() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('is_commissioner').eq('id', user.id).single();
  if (!profile?.is_commissioner) throw new Error('FORBIDDEN');
  return { supabase, user };
}

export async function requirePoolManager(poolId: string) {
  const { supabase, user } = await requireUser();
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id,organization_id,sport,pool_type,season')
    .eq('id', poolId)
    .maybeSingle();
  if (poolError) throw poolError;
  if (!pool) throw new Error('NOT_FOUND');

  const [{ data: organization }, { data: organizationMember }, { data: leagueMember }] = await Promise.all([
    supabase.from('organizations').select('owner_user_id').eq('id', pool.organization_id).maybeSingle(),
    supabase.from('organization_members').select('role,status').eq('organization_id', pool.organization_id).eq('user_id', user.id).maybeSingle(),
    supabase.from('league_members').select('role,status').eq('pool_id', poolId).eq('user_id', user.id).maybeSingle(),
  ]);
  const canManage = organization?.owner_user_id === user.id
    || (organizationMember?.status === 'ACTIVE' && ['OWNER', 'ADMIN', 'COMMISSIONER'].includes(organizationMember.role))
    || (leagueMember?.status === 'ACTIVE' && ['COMMISSIONER', 'CO_COMMISSIONER'].includes(leagueMember.role));
  if (!canManage) throw new Error('FORBIDDEN');
  return { supabase, user, pool };
}
