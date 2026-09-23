import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request){
  try{
    const {user}=await requireUser();const body=await request.json();
    const token=typeof body.token==='string'?body.token.trim():'';const platform=body.platform;
    if(!token||token.length>4096||!['ios','android'].includes(platform))return NextResponse.json({error:'Invalid native push registration.'},{status:400});
    const admin=createAdminClient();
    const {error}=await admin.from('native_push_tokens').upsert({user_id:user.id,platform,token,app_id:'com.sportssyndicate.fantasy',last_seen_at:new Date().toISOString(),disabled_at:null},{onConflict:'token'});
    if(error)throw error;
    const {error:preferencesError}=await admin.from('notification_preferences').upsert({user_id:user.id,push_enabled:true,pick_reminders:true,results_updates:true,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(preferencesError)throw preferencesError;
    return NextResponse.json({subscribed:true});
  }catch(error){const message=error instanceof Error?error.message:'Could not save native push registration.';return NextResponse.json({error:message},{status:message==='UNAUTHENTICATED'?401:500});}
}

export async function DELETE(request:Request){
  try{
    const {user}=await requireUser();const body=await request.json().catch(()=>({}));const platform=body.platform;
    if(!['ios','android'].includes(platform))return NextResponse.json({error:'Invalid platform.'},{status:400});
    const admin=createAdminClient();const {error}=await admin.from('native_push_tokens').update({disabled_at:new Date().toISOString()}).eq('user_id',user.id).eq('platform',platform).is('disabled_at',null);
    if(error)throw error;return NextResponse.json({subscribed:false});
  }catch(error){const message=error instanceof Error?error.message:'Could not disable native notifications.';return NextResponse.json({error:message},{status:message==='UNAUTHENTICATED'?401:500});}
}
