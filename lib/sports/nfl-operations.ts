import { createAdminClient } from '@/lib/supabase/admin';
import { getNFLScoreProvider } from '@/lib/sports/provider';
import { calculateFullPprPoints } from '@/lib/sports/fantasy-scoring';

type SeasonType = 'REG' | 'POST';
type ScoringTrigger = 'cron' | 'commissioner' | 'admin';
type ScoringRunOptions = {trigger?:ScoringTrigger;recordRun?:boolean};

function messageFrom(error:unknown){
  return error instanceof Error?error.message:typeof error==='object'&&error&&'message' in error?String(error.message):String(error);
}

async function updateIds(admin:any,table:string,ids:string[],values:Record<string,unknown>){
  let updated=0;
  const unique=[...new Set(ids)];
  for(let index=0;index<unique.length;index+=250){
    const {data,error}=await admin.from(table).update(values).in('id',unique.slice(index,index+250)).select('id');
    if(error)throw error;
    updated+=data?.length||0;
  }
  return updated;
}

export function deadlineForWeek(games:any[], mode:string){
  const kickoffs=games.map(game=>new Date(game.kickoff_at).getTime()).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!kickoffs.length) return null;
  if(mode==='SUNDAY_10AM_PT'){
    const sunday=games.filter(game=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',weekday:'short'}).format(new Date(game.kickoff_at))==='Sun')
      .map(game=>new Date(game.kickoff_at).getTime()).sort((a,b)=>a-b);
    return new Date(sunday[0]??kickoffs[kickoffs.length-1]);
  }
  return new Date(kickoffs[kickoffs.length-1]);
}

export function pickLockAt(game:any,weekGames:any[],mode:string){
  const kickoff=new Date(game.kickoff_at);
  if(mode!=='SUNDAY_10AM_PT')return kickoff;
  const weeklyDeadline=deadlineForWeek(weekGames,mode);
  return weeklyDeadline&&weeklyDeadline<kickoff?weeklyDeadline:kickoff;
}

export async function syncNFLWeek(season:number,week:number,seasonType:SeasonType='REG',client?:any){
  const admin=client||createAdminClient();
  const provider=getNFLScoreProvider();
  const games=await provider.gamesByWeek(String(season),week,seasonType);
  const providerIds=games.map(game=>game.id);
  const {data:existingGames,error:existingError}=await admin.from('games').select('id,provider_game_id,raw,status,away_score,home_score,winner_team').in('provider_game_id',providerIds);
  if(existingError)throw new Error(existingError.message);
  const existingByProviderId=new Map((existingGames||[]).map((game:any)=>[game.provider_game_id,game]));
  const playoffLabels:Record<number,string>={1:'Wild Card',2:'Divisional',3:'Conference Championship',4:'Super Bowl'};
  const fetchedAt=new Date().toISOString();
  const rows=games.map(game=>{
    const existing:any=existingByProviderId.get(game.id);
    const priorRaw=existing?.raw&&typeof existing.raw==='object'?existing.raw:{};
    const manualOverride=priorRaw.manualOverride;
    const providerResult={
      status:game.status,awayScore:game.awayScore??null,homeScore:game.homeScore??null,
      winnerTeam:game.status==='FINAL'&&game.awayScore!==game.homeScore?(Number(game.awayScore)>Number(game.homeScore)?game.awayTeamCode:game.homeTeamCode):null,
      fetchedAt,
    };
    return {
      provider_game_id:game.id,sport:'NFL',season:Number(game.season),week:game.week,round_label:seasonType==='POST'?(playoffLabels[game.week]||`Playoff Round ${game.week}`):`Week ${game.week}`,
      away_team:game.awayTeamCode,home_team:game.homeTeamCode,kickoff_at:game.startsAt,status:manualOverride?existing.status:game.status,
      away_score:manualOverride?existing.away_score:game.awayScore??null,home_score:manualOverride?existing.home_score:game.homeScore??null,
      winner_team:manualOverride?existing.winner_team:providerResult.winnerTeam,
      raw:{
        ...priorRaw,provider:provider.name,seasonType,providerResult,
        market:game.awayWinProbability!=null&&game.homeWinProbability!=null?{
        awayWinProbability:game.awayWinProbability,
        homeWinProbability:game.homeWinProbability,
        provider:game.marketProvider||'Market',
        updatedAt:fetchedAt,
      }:null,
      },updated_at:fetchedAt,
    };
  });
  if(!client){
    const {error}=await admin.from('games').upsert(rows,{onConflict:'provider_game_id'});
    if(error)throw new Error(error.message);
    return {provider:provider.name,synced:rows.length,manualOverrides:rows.filter((row:any)=>row.raw?.manualOverride).length};
  }
  for(const row of rows){
    const existing:any=existingByProviderId.get(row.provider_game_id);
    if(existing){
      const {error}=await admin.from('games').update(row).eq('id',existing.id);
      if(error)throw new Error(error.message);
    }else throw new Error(`Game ${row.provider_game_id} is missing from the league schedule. Run the server schedule import first.`);
  }
  return {provider:provider.name,synced:rows.length,manualOverrides:rows.filter((row:any)=>row.raw?.manualOverride).length};
}

export async function gradeNFLWeek(season:number,week:number,now=new Date(),client?:any,poolId?:string){
  const admin=client||createAdminClient();
  const {data:games,error:gamesError}=await admin.from('games').select('*').eq('sport','NFL').eq('season',season).eq('week',week);
  if(gamesError)throw gamesError;
  const weekGames:any[]=(games||[]) as any[];
  const finalGames=weekGames.filter(game=>game.status==='FINAL');
  const gameById=new Map<string,any>(weekGames.map((game:any)=>[game.id,game]));
  const finalIds=finalGames.map(game=>game.id);
  let pickemGraded=0,survivorGraded=0,eliminated=0,restored=0,missed=0;

  if(finalIds.length){
    let pickemPoolsQuery=admin.from('pools').select('id').eq('sport','NFL').eq('season',season).eq('pool_type','PICKEM').eq('is_active',true);
    if(poolId)pickemPoolsQuery=pickemPoolsQuery.eq('id',poolId);
    const {data:pickemPools,error:pickemPoolsError}=await pickemPoolsQuery;
    if(pickemPoolsError)throw pickemPoolsError;
    const pickemPoolIds=(pickemPools||[]).map((pool:any)=>pool.id);
    const {data:pickemEntries,error:pickemEntriesError}=pickemPoolIds.length?await admin.from('entries').select('id').in('pool_id',pickemPoolIds):{data:[],error:null};
    if(pickemEntriesError)throw pickemEntriesError;
    const pickemEntryIds=(pickemEntries||[]).map((entry:any)=>entry.id);
    const {data:picks,error}=pickemEntryIds.length?await admin.from('pickem_picks').select('id,game_id,selected_team,is_correct').in('entry_id',pickemEntryIds).in('game_id',finalIds):{data:[],error:null};
    if(error)throw error;
    const correctIds:string[]=[];const incorrectIds:string[]=[];
    for(const pick of picks||[]){
      const game=gameById.get(pick.game_id);
      const correct=!!game?.winner_team&&pick.selected_team===game.winner_team;
      (correct?correctIds:incorrectIds).push(pick.id);
    }
    pickemGraded+=await updateIds(admin,'pickem_picks',correctIds,{is_correct:true});
    pickemGraded+=await updateIds(admin,'pickem_picks',incorrectIds,{is_correct:false});
  }

  let poolsQuery=admin.from('pools').select('id,scoring_settings').eq('sport','NFL').eq('season',season).eq('pool_type','SURVIVOR').eq('is_active',true);
  if(poolId)poolsQuery=poolsQuery.eq('id',poolId);
  const {data:pools,error:poolsError}=await poolsQuery;
  if(poolsError)throw poolsError;
  for(const pool of pools||[]){
    const {data:entries,error:entriesError}=await admin.from('entries').select('id,entry_status,elimination_week,elimination_reason').eq('pool_id',pool.id);
    if(entriesError)throw entriesError;
    const entryIds=(entries||[]).map((entry:any)=>entry.id);
    if(!entryIds.length)continue;
    const {data:picks,error:picksError}=await admin.from('survivor_picks').select('id,entry_id,game_id,team_code,result').in('entry_id',entryIds).eq('week',week);
    if(picksError)throw picksError;
    const winningPickIds:string[]=[];const losingPickIds:string[]=[];const losingEntryIds:string[]=[];
    for(const pick of picks||[]){
      const game=gameById.get(pick.game_id);
      if(!game||game.status!=='FINAL')continue;
      const result=game.winner_team===pick.team_code?'WIN':'LOSS';
      (result==='WIN'?winningPickIds:losingPickIds).push(pick.id);
      if(result==='LOSS')losingEntryIds.push(pick.entry_id);
    }
    survivorGraded+=await updateIds(admin,'survivor_picks',winningPickIds,{result:'WIN'});
    survivorGraded+=await updateIds(admin,'survivor_picks',losingPickIds,{result:'LOSS'});
    const losingEntrySet=new Set(losingEntryIds);
    const lossEligibleIds=(entries||[]).filter((entry:any)=>losingEntrySet.has(entry.id)&&(entry.entry_status==='ACTIVE'||(entry.entry_status==='ELIMINATED'&&entry.elimination_week===week&&['GAME_LOSS','MISSED_PICK'].includes(entry.elimination_reason)))).map((entry:any)=>entry.id);
    eliminated+=await updateIds(admin,'entries',lossEligibleIds,{entry_status:'ELIMINATED',elimination_week:week,elimination_reason:'GAME_LOSS',eliminated_at:now.toISOString()});
    const settings=pool.scoring_settings||{};
    const deadline=deadlineForWeek(weekGames,settings.deadline_mode||'GAME_KICKOFF');
    let missingIds:string[]=[];
    if(settings.missed_pick_elimination!==false&&deadline&&now>=deadline){
      const picked=new Set((picks||[]).map((pick:any)=>pick.entry_id));
      missingIds=(entries||[]).filter((entry:any)=>entry.entry_status==='ACTIVE'&&!picked.has(entry.id)).map((entry:any)=>entry.id);
      missed+=missingIds.length;
      eliminated+=await updateIds(admin,'entries',missingIds,{entry_status:'ELIMINATED',elimination_week:week,elimination_reason:'MISSED_PICK',eliminated_at:now.toISOString()});
    }
    const shouldRemainEliminated=new Set([...losingEntryIds,...missingIds]);
    const restorableIds=(entries||[]).filter((entry:any)=>entry.entry_status==='ELIMINATED'&&entry.elimination_week===week&&['GAME_LOSS','MISSED_PICK'].includes(entry.elimination_reason)&&!shouldRemainEliminated.has(entry.id)).map((entry:any)=>entry.id);
    restored+=await updateIds(admin,'entries',restorableIds,{entry_status:'ACTIVE',elimination_week:null,elimination_reason:null,eliminated_at:null});
  }
  return {season,week,finalGames:finalGames.length,pickemGraded,survivorGraded,eliminated,restored,missed};
}

export async function gradeNFLFantasyRound(season:number,roundOrder:number,client?:any){
  const admin=client||createAdminClient();
  const provider=getNFLScoreProvider();
  const stats=await provider.playerStatsByWeek(String(season),roundOrder,'POST');
  const {data:pools,error:poolsError}=await admin.from('pools').select('id,scoring_settings').eq('sport','NFL').eq('season',season).eq('pool_type','PLAYOFF_FANTASY').eq('is_active',true);
  if(poolsError)throw poolsError;
  let graded=0;
  const statByProviderId=new Map<string,any>();
  for(const stat of stats){
    const current=statByProviderId.get(stat.athleteId)||{...stat,passingYards:0,passingTouchdowns:0,interceptions:0,rushingYards:0,rushingTouchdowns:0,receptions:0,receivingYards:0,receivingTouchdowns:0,fumblesLost:0,twoPointConversions:0};
    for(const key of ['passingYards','passingTouchdowns','interceptions','rushingYards','rushingTouchdowns','receptions','receivingYards','receivingTouchdowns','fumblesLost','twoPointConversions']) current[key]+=Number((stat as any)[key]||0);
    statByProviderId.set(stat.athleteId,current);
  }
  for(const pool of pools||[]){
    const {data:round}=await admin.from('rounds').select('id').eq('pool_id',pool.id).eq('round_order',roundOrder).maybeSingle();
    if(!round)continue;
    const {data:entries}=await admin.from('entries').select('id').eq('pool_id',pool.id);
    const entryIds=(entries||[]).map((entry:any)=>entry.id);
    if(!entryIds.length)continue;
    const {data:picks}=await admin.from('playoff_fantasy_picks').select('id,athlete_id').eq('round_id',round.id).in('entry_id',entryIds);
    const athleteIds=[...new Set((picks||[]).map((pick:any)=>pick.athlete_id))];
    const {data:athletes}=athleteIds.length?await admin.from('athletes').select('id,provider_athlete_id').in('id',athleteIds):{data:[]};
    const providerById=new Map((athletes||[]).map((athlete:any)=>[athlete.id,athlete.provider_athlete_id]));
    for(const pick of picks||[]){
      const stat=statByProviderId.get(String(providerById.get(pick.athlete_id)||''));
      if(!stat)continue;
      const points=calculateFullPprPoints(stat,pool.scoring_settings);
      const {error}=await admin.from('playoff_fantasy_picks').update({fantasy_points:points}).eq('id',pick.id);
      if(error)throw error;
      graded++;
    }
  }
  return {roundOrder,stats:stats.length,fantasyGraded:graded};
}

export async function syncAndGradeNFLWeek(season:number,week:number,seasonType:SeasonType='REG',client?:any,poolId?:string,options:ScoringRunOptions={}){
  const shouldRecord=options.recordRun===true;
  const audit=shouldRecord?createAdminClient():null;
  let runId:string|undefined;
  if(audit){
    const {data,error}=await audit.from('scoring_runs').insert({pool_id:poolId||null,sport:'NFL',season,week,season_type:seasonType,trigger_source:options.trigger||'admin',status:'RUNNING'}).select('id').single();
    if(error)throw new Error(`Could not start scoring audit: ${error.message}`);
    runId=data.id;
  }
  try{
    const sync=await syncNFLWeek(season,week,seasonType,client);
    const grading=seasonType==='POST'?await gradeNFLFantasyRound(season,week,client):await gradeNFLWeek(season,week,new Date(),client,poolId);
    const result={...sync,...grading,runId};
    if(audit&&runId){
      const {error}=await audit.from('scoring_runs').update({status:'SUCCEEDED',provider:sync.provider,details:result,completed_at:new Date().toISOString()}).eq('id',runId);
      if(error)console.error('[nfl/scoring] could not complete audit',{runId,error:error.message});
    }
    return result;
  }catch(error){
    if(audit&&runId){
      const auditError=await audit.from('scoring_runs').update({status:'FAILED',error_message:messageFrom(error).slice(0,1000),completed_at:new Date().toISOString()}).eq('id',runId);
      if(auditError.error)console.error('[nfl/scoring] could not record failure',{runId,error:auditError.error.message});
    }
    throw error;
  }
}
