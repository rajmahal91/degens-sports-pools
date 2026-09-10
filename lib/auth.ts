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
