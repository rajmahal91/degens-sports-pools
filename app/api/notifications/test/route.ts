import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverNotification,groupPreferences,groupSubscriptions } from '@/lib/notifications/delivery';

export async function POST(){
  try{
    const {user}=await requireUser();const admin=createAdminClient();
    const [{data:subscriptions,error:subscriptionsError},{data:preferences,error:preferencesError}]=await Promise.all([
      admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').eq('user_id',user.id).is('disabled_at',null),
      admin.from('notification_preferences').select('user_id,push_enabled,pick_reminders,results_updates').eq('user_id',user.id),
    ]);
    if(subscriptionsError)throw subscriptionsError;if(preferencesError)throw preferencesError;
    if(!subscriptions?.length)return NextResponse.json({error:'Enable notifications on this device first.'},{status:400});
    const result=await deliverNotification(admin,{userId:user.id,dedupeKey:`${user.id}-test-${randomUUID()}`,notificationType:'TEST',title:'Notifications are working',body:'You’ll now receive pool deadlines, missed-pick alerts, and results.',url:'/account',bypassPreferences:true},groupSubscriptions(subscriptions),groupPreferences(preferences||[]));
    if(!result.sent)return NextResponse.json({error:'The test notification could not be delivered.'},{status:502});
    return NextResponse.json({sent:result.sent});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not send a test notification.'},{status:500});}
}
