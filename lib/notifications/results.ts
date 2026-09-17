import { createAdminClient } from '@/lib/supabase/admin';
import { deliverNotification,groupPreferences,groupSubscriptions,type PushMessage } from '@/lib/notifications/delivery';

export async function sendNFLResultNotifications(season:number,week:number,poolId?:string){
  const admin=createAdminClient();
  let poolsQuery=admin.from('pools').select('id,name,pool_type').eq('sport','NFL').eq('season',season).in('pool_type',['SURVIVOR','PICKEM']).eq('is_active',true);
  if(poolId)poolsQuery=poolsQuery.eq('id',poolId);
  const {data:pools,error:poolsError}=await poolsQuery;
  if(poolsError)throw poolsError;
  const poolIds=(pools||[]).map((pool:any)=>pool.id);
  if(!poolIds.length)return {candidates:0,sent:0,skipped:0};
  const [{data:entries,error:entriesError},{data:games,error:gamesError},{data:subscriptions,error:subscriptionsError},{data:preferences,error:preferencesError}]=await Promise.all([
    admin.from('entries').select('id,pool_id,user_id,entry_name,entry_status,elimination_week,elimination_reason').in('pool_id',poolIds),
    admin.from('games').select('id,status').eq('sport','NFL').eq('season',season).eq('week',week),
    admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').is('disabled_at',null),
    admin.from('notification_preferences').select('user_id,push_enabled,results_updates'),
  ]);
  if(entriesError)throw entriesError;if(gamesError)throw gamesError;if(subscriptionsError)throw subscriptionsError;if(preferencesError)throw preferencesError;
  const entryIds=(entries||[]).map((entry:any)=>entry.id);
  const gameIds=(games||[]).map((game:any)=>game.id);
  const [{data:survivorPicks,error:survivorError},{data:pickemPicks,error:pickemError}]=await Promise.all([
    entryIds.length?admin.from('survivor_picks').select('entry_id,team_code,result').in('entry_id',entryIds).eq('week',week):{data:[],error:null},
    entryIds.length&&gameIds.length?admin.from('pickem_picks').select('entry_id,is_correct').in('entry_id',entryIds).in('game_id',gameIds):{data:[],error:null},
  ]);
  if(survivorError)throw survivorError;if(pickemError)throw pickemError;
  const poolById=new Map((pools||[]).map((pool:any)=>[pool.id,pool]));
  const survivorByEntry=new Map((survivorPicks||[]).map((pick:any)=>[pick.entry_id,pick]));
  const pickemByEntry=new Map<string,any[]>();for(const pick of pickemPicks||[])pickemByEntry.set(pick.entry_id,[...(pickemByEntry.get(pick.entry_id)||[]),pick]);
  const allGamesFinal=Boolean((games||[]).length)&&(games||[]).every((game:any)=>game.status==='FINAL');
  const messages:PushMessage[]=[];
  for(const entry of entries||[]){
    const pool:any=poolById.get(entry.pool_id);if(!pool)continue;
    const url=`/?tab=pools&week=${week}`;
    if(pool.pool_type==='SURVIVOR'){
      const pick:any=survivorByEntry.get(entry.id);
      let outcome:string|undefined;let title='';let body='';
      if(entry.elimination_week===week&&entry.elimination_reason==='MISSED_PICK'){outcome='MISSED';title='Survivor entry eliminated';body=`${entry.entry_name} was eliminated after missing the Week ${week} deadline.`;}
      else if(pick?.result==='LOSS'){outcome='LOSS';title='Survivor entry eliminated';body=`${entry.entry_name} was eliminated in Week ${week} with ${pick.team_code}.`;}
      else if(pick?.result==='WIN'){outcome='WIN';title='Survivor pick won';body=`${entry.entry_name} advanced through Week ${week} with ${pick.team_code}.`;}
      if(outcome)messages.push({userId:entry.user_id,dedupeKey:`${entry.id}-survivor-result-${week}-${outcome}`,notificationType:`SURVIVOR_${outcome}`,title,body,url,preference:'results_updates'});
    }else if(pool.pool_type==='PICKEM'&&allGamesFinal){
      const picks=pickemByEntry.get(entry.id)||[];const graded=picks.filter(pick=>pick.is_correct!==null).length;
      if(!graded)continue;
      const correct=picks.filter(pick=>pick.is_correct===true).length;
      messages.push({userId:entry.user_id,dedupeKey:`${entry.id}-pickem-result-${week}`,notificationType:'PICKEM_RESULTS',title:`Pick’em Week ${week} results`,body:`${entry.entry_name}: ${correct} correct from ${graded} submitted picks.`,url,preference:'results_updates'});
    }
  }
  const subscriptionsByUser=groupSubscriptions(subscriptions||[]);const preferencesByUser=groupPreferences(preferences||[]);
  let sent=0;let skipped=0;for(const message of messages){const result=await deliverNotification(admin,message,subscriptionsByUser,preferencesByUser);sent+=result.sent;skipped+=result.skipped;}
  return {candidates:messages.length,sent,skipped};
}
