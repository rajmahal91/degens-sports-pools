import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pushIsConfigured } from '@/lib/notifications/web-push';

export async function GET(){
  try{
    const {supabase,user}=await requireUser();
    const [{data:preferences},{data:subscriptions},{data:nativeTokens}]=await Promise.all([
      supabase.from('notification_preferences').select('push_enabled,pick_reminders,results_updates').eq('user_id',user.id).maybeSingle(),
      supabase.from('push_subscriptions').select('id').eq('user_id',user.id).is('disabled_at',null),
      supabase.from('native_push_tokens').select('id,platform').eq('user_id',user.id).is('disabled_at',null),
    ]);
    return NextResponse.json({configured:pushIsConfigured(),enabled:Boolean(preferences?.push_enabled&&((subscriptions?.length||0)+(nativeTokens?.length||0))),subscriptionCount:subscriptions?.length||0,nativeTokens:nativeTokens||[],preferences:preferences||{push_enabled:true,pick_reminders:true,results_updates:true}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not load notification settings.'},{status:401});}
}
