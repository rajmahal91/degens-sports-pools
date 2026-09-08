import { createClient } from '@/lib/supabase/server';

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHENTICATED');
  return { supabase, user };
}

export async function requireCommissioner() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('is_commissioner').eq('id', user.id).single();
  if (!profile?.is_commissioner) throw new Error('FORBIDDEN');
  return { supabase, user };
}
