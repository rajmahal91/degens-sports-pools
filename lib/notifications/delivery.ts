import { sendWebPush,type StoredPushSubscription } from '@/lib/notifications/web-push';

export type NotificationPreference='pick_reminders'|'results_updates';
export type PushMessage={
  userId:string;
  dedupeKey:string;
  notificationType:string;
  title:string;
  body:string;
  url:string;
  preference?:NotificationPreference;
  bypassPreferences?:boolean;
};

export function groupSubscriptions(subscriptions:any[]){
  const grouped=new Map<string,any[]>();
  for(const subscription of subscriptions)grouped.set(subscription.user_id,[...(grouped.get(subscription.user_id)||[]),subscription]);
  return grouped;
}

export function groupPreferences(preferences:any[]){
  return new Map<string,any>((preferences||[]).map(preference=>[preference.user_id,preference]));
}

export async function deliverNotification(admin:any,message:PushMessage,subscriptionsByUser:Map<string,any[]>,preferencesByUser:Map<string,any>){
  const preferences=preferencesByUser.get(message.userId);
  if(!message.bypassPreferences&&(preferences?.push_enabled===false||(message.preference&&preferences?.[message.preference]===false)))return {sent:0,skipped:1};
  const subscriptions=subscriptionsByUser.get(message.userId)||[];
  if(!subscriptions.length)return {sent:0,skipped:1};
  const {data:delivery,error}=await admin.from('notification_deliveries').insert({user_id:message.userId,dedupe_key:message.dedupeKey,notification_type:message.notificationType,title:message.title,body:message.body,target_url:message.url,status:'PENDING'}).select('id').maybeSingle();
  if(error){if(error.code==='23505')return {sent:0,skipped:1};throw error;}
  if(!delivery)return {sent:0,skipped:1};
  let sent=0;let lastError='';
  for(const subscription of subscriptions){
    try{await sendWebPush(subscription as StoredPushSubscription,{title:message.title,body:message.body,url:message.url,tag:message.dedupeKey});sent++;}
    catch(error){
      lastError=error instanceof Error?error.message:String(error);
      const status=(error as Error&{status?:number}).status;
      if(status===404||status===410)await admin.from('push_subscriptions').update({disabled_at:new Date().toISOString()}).eq('id',subscription.id);
    }
  }
  await admin.from('notification_deliveries').update({status:sent?'SENT':'FAILED',error_message:sent?null:lastError,sent_at:sent?new Date().toISOString():null}).eq('id',delivery.id);
  return {sent,skipped:0};
}
