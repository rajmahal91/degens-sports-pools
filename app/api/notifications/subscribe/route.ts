import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { publicVapidKey } from '@/lib/notifications/web-push';

function validBase64Url(value:unknown){return typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value)&&value.length>=16&&value.length<=256;}

export async function POST(request:Request){
  try{
    const {supabase,user}=await requireUser();
    if(!publicVapidKey())return NextResponse.json({error:'Push notifications are not configured yet.'},{status:503});
    const body=await request.json();const subscription=body?.subscription;
    if(!subscription||typeof subscription.endpoint!=='string'||!/^https:\/\//.test(subscription.endpoint)||!validBase64Url(subscription.keys?.p256dh)||!validBase64Url(subscription.keys?.auth))return NextResponse.json({error:'Invalid push subscription.'},{status:400});
    const now=new Date().toISOString();
    const {data,error}=await supabase.from('push_subscriptions').upsert({user_id:user.id,endpoint:subscription.endpoint.slice(0,2000),p256dh:subscription.keys.p256dh,auth:subscription.keys.auth,user_agent:request.headers.get('user-agent')?.slice(0,500)||null,last_seen_at:now,disabled_at:null},{onConflict:'endpoint'}).select('id').single();
    if(error)throw error;
    const {error:preferenceError}=await supabase.from('notification_preferences').upsert({user_id:user.id,push_enabled:true,pick_reminders:true,results_updates:true,updated_at:now},{onConflict:'user_id'});
    if(preferenceError)throw preferenceError;
    return NextResponse.json({success:true,subscriptionId:data.id});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not enable notifications.'},{status:400});}
}

export async function DELETE(request:Request){
  try{
    const {supabase,user}=await requireUser();const body=await request.json().catch(()=>({}));
    const endpoint=String(body?.endpoint||'');
    if(!endpoint)return NextResponse.json({error:'Subscription endpoint is required.'},{status:400});
    const {error}=await supabase.from('push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('endpoint',endpoint).eq('user_id',user.id);
    if(error)throw error;
    return NextResponse.json({success:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not disable notifications.'},{status:400});}
}
