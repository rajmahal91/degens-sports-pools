import { createAdminClient } from '@/lib/supabase/admin';
import { deadlineForWeek,pickLockAt } from '@/lib/sports/nfl-operations';
import { deliverNotification,groupPreferences,groupSubscriptions } from '@/lib/notifications/delivery';

type Reminder={userId:string;poolId:string;entryId:string;type:'ONE_DAY'|'ONE_HOUR'|'MISSED';dedupeKey:string;title:string;body:string;url:string};

function windowFor(target:Date,now:Date){
  const minutes=(target.getTime()-now.getTime())/60000;
  if(minutes>=18*60&&minutes<=36*60)return 'ONE_DAY' as const;
  if(minutes>=30&&minutes<=90)return 'ONE_HOUR' as const;
  if(minutes<=0&&minutes>=-24*60)return 'MISSED' as const;
  return null;
}

export async function sendPickReminders(now=new Date()){
  const admin=createAdminClient();
  const horizon=new Date(now.getTime()+8*24*60*60*1000).toISOString();
  const past=new Date(now.getTime()-24*60*60*1000).toISOString();
  const {data:pools,error:poolsError}=await admin.from('pools').select('id,name,pool_type,season,scoring_settings').eq('sport','NFL').eq('is_active',true);
  if(poolsError)throw poolsError;
  const poolIds=(pools||[]).map((pool:any)=>pool.id);if(!poolIds.length)return {candidates:0,sent:0,skipped:0};
  const seasons=[...new Set((pools||[]).map((pool:any)=>Number(pool.season)).filter(Number.isInteger))];
  const [{data:entries,error:entriesError},{data:games,error:gamesError},{data:subscriptions,error:subscriptionsError},{data:preferences,error:preferencesError}]=await Promise.all([
    admin.from('entries').select('id,pool_id,user_id,entry_status').in('pool_id',poolIds).eq('entry_status','ACTIVE'),
    admin.from('games').select('*').eq('sport','NFL').in('season',seasons).gte('kickoff_at',past).lte('kickoff_at',horizon).order('kickoff_at'),
    admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').is('disabled_at',null),
    admin.from('notification_preferences').select('user_id,push_enabled,pick_reminders'),
  ]);
  if(entriesError)throw entriesError;if(gamesError)throw gamesError;if(subscriptionsError)throw subscriptionsError;if(preferencesError)throw preferencesError;
  const entryIds=(entries||[]).map((entry:any)=>entry.id);
  const [{data:survivorPicks,error:survivorError},{data:pickemPicks,error:pickemError}]=await Promise.all([
    entryIds.length?admin.from('survivor_picks').select('entry_id,week').in('entry_id',entryIds):{data:[],error:null},
    entryIds.length?admin.from('pickem_picks').select('entry_id,game_id').in('entry_id',entryIds):{data:[],error:null},
  ]);
  if(survivorError)throw survivorError;if(pickemError)throw pickemError;
  const poolById=new Map((pools||[]).map((pool:any)=>[pool.id,pool]));
  const gamesByWeek=new Map<string,any[]>();for(const game of games||[]){const key=`${game.season}-${game.week}`;gamesByWeek.set(key,[...(gamesByWeek.get(key)||[]),game]);}
  const survivorSet=new Set((survivorPicks||[]).map((pick:any)=>`${pick.entry_id}-${pick.week}`));
  const pickemSet=new Set((pickemPicks||[]).map((pick:any)=>`${pick.entry_id}-${pick.game_id}`));
  const subscriptionsByUser=groupSubscriptions(subscriptions||[]);
  const preferencesByUser=groupPreferences(preferences||[]);
  const reminders:Reminder[]=[];
  for(const entry of entries||[]){
    const pool=poolById.get(entry.pool_id);if(!pool)continue;
    if(pool.pool_type==='SURVIVOR'){
      for(const [weekKey,weekGames] of gamesByWeek){
        const [season,week]=weekKey.split('-').map(Number);if(season!==Number(pool.season)||survivorSet.has(`${entry.id}-${week}`))continue;
        const mode=pool.scoring_settings?.deadline_mode||'GAME_KICKOFF';
        const target=mode==='SUNDAY_10AM_PT'?deadlineForWeek(weekGames,mode):new Date(Math.min(...weekGames.filter((game:any)=>new Date(game.kickoff_at)>now).map((game:any)=>new Date(game.kickoff_at).getTime()),...weekGames.map((game:any)=>new Date(game.kickoff_at).getTime())));
        if(!target||!Number.isFinite(target.getTime()))continue;
        const reminderType=windowFor(target,now);if(!reminderType)continue;
        reminders.push({userId:entry.user_id,poolId:entry.pool_id,entryId:entry.id,type:reminderType,dedupeKey:`${entry.id}-survivor-${week}-${reminderType}`,title:reminderType==='MISSED'?'Survivor pick missed':'Survivor pick deadline approaching',body:reminderType==='MISSED'?`Your Week ${week} Survivor pick was not submitted and may be eliminated.`:`Submit your Week ${week} Survivor pick before ${target.toLocaleString('en-CA',{weekday:'short',hour:'numeric',minute:'2-digit',timeZone:'America/Vancouver'})}.`,url:`/?tab=pools&week=${week}`});
      }
    }
    if(pool.pool_type==='PICKEM'){
      const relevantGames=(games||[]).filter((game:any)=>Number(game.season)===Number(pool.season));
      for(const game of relevantGames){
        if(pickemSet.has(`${entry.id}-${game.id}`))continue;
        const weekGames=gamesByWeek.get(`${game.season}-${game.week}`)||[];const target=pickLockAt(game,weekGames,pool.scoring_settings?.deadline_mode||'GAME_KICKOFF');const reminderType=windowFor(target,now);if(!reminderType)continue;
        reminders.push({userId:entry.user_id,poolId:entry.pool_id,entryId:entry.id,type:reminderType,dedupeKey:`${entry.id}-pickem-${game.id}-${reminderType}`,title:reminderType==='MISSED'?'Pick’em game missed':'Pick’em deadline approaching',body:reminderType==='MISSED'?`Your Pick’em selection for ${game.away_team} at ${game.home_team} was not submitted before lock.`:`Choose ${game.away_team} at ${game.home_team} before it locks.`,url:`/?tab=pools&week=${game.week}`});
      }
    }
  }
  let sent=0;let skipped=0;for(const reminder of reminders){const result=await deliverNotification(admin,{...reminder,notificationType:`PICK_${reminder.type}`,preference:'pick_reminders'},subscriptionsByUser,preferencesByUser);sent+=result.sent;skipped+=result.skipped;}
  return {candidates:reminders.length,sent,skipped};
}
