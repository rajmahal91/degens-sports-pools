import { createAdminClient } from '@/lib/supabase/admin';
import { getNFLProvider } from '@/lib/sports/provider';

type SeasonType = 'REG' | 'POST';

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

export async function syncNFLWeek(season:number,week:number,seasonType:SeasonType='REG'){
  const admin=createAdminClient();
  const provider=getNFLProvider();
  const games=await provider.gamesByWeek(String(season),week,seasonType);
  const rows=games.map(game=>({
    provider_game_id:game.id,sport:'NFL',season:Number(game.season),week:game.week,round_label:`Week ${game.week}`,
    away_team:game.awayTeamCode,home_team:game.homeTeamCode,kickoff_at:game.startsAt,status:game.status,
    away_score:game.awayScore??null,home_score:game.homeScore??null,
    winner_team:game.status==='FINAL'&&game.awayScore!==game.homeScore?(Number(game.awayScore)>Number(game.homeScore)?game.awayTeamCode:game.homeTeamCode):null,
    raw:{provider:provider.name},updated_at:new Date().toISOString(),
  }));
  for(const row of rows){
    const {data:existing,error:lookupError}=await admin.from('games').select('id').eq('provider_game_id',row.provider_game_id).maybeSingle();
    if(lookupError)throw new Error(lookupError.message);
    if(existing){
      const {error}=await admin.from('games').update(row).eq('id',existing.id);
      if(error)throw new Error(error.message);
    }else{
      const {error}=await admin.from('games').insert(row);
      if(error)throw new Error(error.message);
    }
  }
  return {provider:provider.name,synced:rows.length};
}

export async function gradeNFLWeek(season:number,week:number,now=new Date()){
  const admin=createAdminClient();
  const {data:games,error:gamesError}=await admin.from('games').select('*').eq('sport','NFL').eq('season',season).eq('week',week);
  if(gamesError)throw gamesError;
  const weekGames=games||[];
  const finalGames=weekGames.filter(game=>game.status==='FINAL');
  const gameById=new Map(weekGames.map(game=>[game.id,game]));
  const finalIds=finalGames.map(game=>game.id);
  let pickemGraded=0,survivorGraded=0,eliminated=0,missed=0;

  if(finalIds.length){
    const {data:picks,error}=await admin.from('pickem_picks').select('id,game_id,selected_team').in('game_id',finalIds);
    if(error)throw error;
    for(const pick of picks||[]){
      const game=gameById.get(pick.game_id);
      const correct=!!game?.winner_team&&pick.selected_team===game.winner_team;
      const {error:updateError}=await admin.from('pickem_picks').update({is_correct:correct}).eq('id',pick.id);
      if(updateError)throw updateError;
      pickemGraded++;
    }
  }

  const {data:pools,error:poolsError}=await admin.from('pools').select('id,scoring_settings').eq('sport','NFL').eq('season',season).eq('pool_type','SURVIVOR').eq('is_active',true);
  if(poolsError)throw poolsError;
  for(const pool of pools||[]){
    const {data:entries,error:entriesError}=await admin.from('entries').select('id,entry_status,payment_status').eq('pool_id',pool.id);
    if(entriesError)throw entriesError;
    const entryIds=(entries||[]).map(entry=>entry.id);
    if(!entryIds.length)continue;
    const {data:picks,error:picksError}=await admin.from('survivor_picks').select('id,entry_id,game_id,team_code,result').in('entry_id',entryIds).eq('week',week);
    if(picksError)throw picksError;
    for(const pick of picks||[]){
      const game=gameById.get(pick.game_id);
      if(!game||game.status!=='FINAL')continue;
      const result=game.winner_team===pick.team_code?'WIN':'LOSS';
      const {error:updateError}=await admin.from('survivor_picks').update({result}).eq('id',pick.id);
      if(updateError)throw updateError;
      survivorGraded++;
      if(result==='LOSS'){
        const {error:entryError}=await admin.from('entries').update({entry_status:'ELIMINATED'}).eq('id',pick.entry_id).eq('pool_id',pool.id).eq('entry_status','ACTIVE');
        if(entryError)throw entryError; eliminated++;
      }
    }
    const settings=pool.scoring_settings||{};
    const deadline=deadlineForWeek(weekGames,settings.deadline_mode||'GAME_KICKOFF');
    if(settings.missed_pick_elimination!==false&&deadline&&now>=deadline){
      const picked=new Set((picks||[]).map(pick=>pick.entry_id));
      const missing=(entries||[]).filter(entry=>entry.entry_status==='ACTIVE'&&entry.payment_status==='PAID'&&!picked.has(entry.id));
      for(const entry of missing){
        const {error}=await admin.from('entries').update({entry_status:'ELIMINATED'}).eq('id',entry.id).eq('pool_id',pool.id).eq('entry_status','ACTIVE');
        if(error)throw error; missed++; eliminated++;
      }
    }
  }
  return {season,week,finalGames:finalGames.length,pickemGraded,survivorGraded,eliminated,missed};
}

export async function syncAndGradeNFLWeek(season:number,week:number,seasonType:SeasonType='REG'){
  const sync=await syncNFLWeek(season,week,seasonType);
  const grading=await gradeNFLWeek(season,week);
  return {...sync,...grading};
}
