import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { syncAndGradeNFLWeek } from '@/lib/sports/nfl-operations';

async function managerContext(poolId:string){
  const {supabase,user}=await requireUser();
  const {data:pool}=await supabase.from('pools').select('*').eq('id',poolId).maybeSingle();
  if(!pool) throw new Error('NOT_FOUND');
  const [{data:organization},{data:orgMember},{data:leagueMember}]=await Promise.all([
    supabase.from('organizations').select('owner_user_id').eq('id',pool.organization_id).maybeSingle(),
    supabase.from('organization_members').select('role,status').eq('organization_id',pool.organization_id).eq('user_id',user.id).maybeSingle(),
    supabase.from('league_members').select('role,status').eq('pool_id',poolId).eq('user_id',user.id).maybeSingle(),
  ]);
  const canManage=organization?.owner_user_id===user.id||(orgMember?.status==='ACTIVE'&&['OWNER','ADMIN','COMMISSIONER'].includes(orgMember.role))||(leagueMember?.status==='ACTIVE'&&['COMMISSIONER','CO_COMMISSIONER'].includes(leagueMember.role));
  if(!canManage) throw new Error('FORBIDDEN');
  return {supabase,user,pool};
}

function failure(error:unknown){
  const message=error instanceof Error?error.message:typeof error==='object'&&error&&'message' in error?String(error.message):typeof error==='string'?error:'Unknown error';
  const status=message==='UNAUTHENTICATED'?401:message==='FORBIDDEN'?403:message==='NOT_FOUND'?404:400;
  return NextResponse.json({error:message==='NOT_FOUND'?'League not found.':message==='FORBIDDEN'?'Commissioner access required.':message},{status});
}

export async function GET(_:Request,{params}:{params:Promise<{poolId:string}>}){
  try{
    const {poolId}=await params;const {supabase,pool}=await managerContext(poolId);
    const [{data:members},{data:entries}]=await Promise.all([
      supabase.from('league_members').select('pool_id,user_id,role,status').eq('pool_id',poolId).order('role'),
      supabase.from('entries').select('*').eq('pool_id',poolId).order('created_at'),
    ]);
    const entryIds=(entries||[]).map(entry=>entry.id);
    let picks:any[]=[];
    if(entryIds.length){
      const table=pool.pool_type==='SURVIVOR'?'survivor_picks':pool.pool_type==='PICKEM'?'pickem_picks':pool.pool_type==='PLAYOFF_FANTASY'?'playoff_fantasy_picks':'bracket_picks';
      const {data}=await supabase.from(table).select('*').in('entry_id',entryIds);
      picks=data||[];
    }
    const [{data:games},{data:latestScoringRun}]=await Promise.all([
      pool.sport==='NFL'?supabase.from('games').select('*').eq('sport','NFL').eq('season',pool.season).order('kickoff_at'):Promise.resolve({data:[]}),
      pool.sport==='NFL'?supabase.from('scoring_runs').select('id,week,status,provider,details,error_message,started_at,completed_at,trigger_source').eq('sport','NFL').eq('season',pool.season).or(`pool_id.eq.${poolId},pool_id.is.null`).order('started_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    ]);
    const gameById=new Map((games||[]).map(game=>[game.id,game]));
    const standings=(entries||[]).map(entry=>{
      const entryPicks=picks.filter(pick=>pick.entry_id===entry.id);
      const wins=pool.pool_type==='PICKEM'?entryPicks.filter(pick=>pick.is_correct===true).length:entryPicks.filter(pick=>pick.result==='WIN').length;
      const losses=pool.pool_type==='PICKEM'?entryPicks.filter(pick=>pick.is_correct===false).length:entryPicks.filter(pick=>pick.result==='LOSS').length;
      const pending=entryPicks.filter(pick=>pool.pool_type==='PICKEM'?pick.is_correct==null:pick.result==null).length;
      return {entry_id:entry.id,entry_name:entry.entry_name,entry_status:entry.entry_status,wins,losses,pending,submitted:entryPicks.length};
    }).sort((a,b)=>Number(b.entry_status==='ACTIVE')-Number(a.entry_status==='ACTIVE')||b.wins-a.wins||a.losses-b.losses||a.entry_name.localeCompare(b.entry_name));
    const visiblePicks=picks.map(pick=>{const game=gameById.get(pick.game_id);return {...pick,week:pick.week??game?.week,locked:!!game&&(game.status!=='SCHEDULED'||new Date(game.kickoff_at).getTime()<=Date.now())};});
    return NextResponse.json({pool,members:members||[],entries:entries||[],picks:visiblePicks,games:games||[],standings,latestScoringRun});
  }catch(error){return failure(error);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{poolId:string}>}){
  try{
    const {poolId}=await params;const {supabase}=await managerContext(poolId);const body=await request.json();
    const name=String(body.name||'').trim().slice(0,80);
    const maxEntries=Math.min(100,Math.max(1,Number(body.maxEntries||1)));
    const maxParticipants=Math.min(1000,Math.max(1,Number(body.maxParticipants||1000)));
    if(name.length<2) return NextResponse.json({error:'Enter a league name.'},{status:400});
    const scoringSettings={deadline_mode:body.deadlineMode==='SUNDAY_10AM_PT'?'SUNDAY_10AM_PT':'GAME_KICKOFF',missed_pick_elimination:body.strictMissedPicks!==false};
    const {data,error}=await supabase.from('pools').update({name,entry_fee_cents:0,max_entries_per_user:maxEntries,max_participants:maxParticipants,scoring_settings:scoringSettings,visibility:body.visibility==='PUBLIC'?'PUBLIC':'INVITE_ONLY'}).eq('id',poolId).select('*').single();
    if(error) throw error;return NextResponse.json({pool:data});
  }catch(error){return failure(error);}
}

export async function POST(request:Request,{params}:{params:Promise<{poolId:string}>}){
  try{
    const {poolId}=await params;const {supabase,user,pool}=await managerContext(poolId);const body=await request.json();
    if(body.action==='regenerate_invite'){
      const inviteCode=randomBytes(4).toString('hex').toUpperCase();
      const codeHash=createHash('sha256').update(inviteCode).digest('hex');
      await supabase.from('league_invitations').update({is_active:false}).eq('pool_id',poolId).eq('is_active',true);
      const {error}=await supabase.from('league_invitations').insert({pool_id:poolId,code_hash:codeHash,code_hint:inviteCode.slice(-4),created_by:user.id});
      if(error) throw error;return NextResponse.json({inviteCode});
    }
    if(body.action==='deactivate_entry'){
      const {error}=await supabase.from('entries').update({entry_status:'INACTIVE'}).eq('id',String(body.entryId)).eq('pool_id',poolId);
      if(error) throw error;return NextResponse.json({success:true});
    }
    if(body.action==='run_scoring'){
      const week=Math.max(1,Math.min(22,Number(body.week)||1));
      const result=await syncAndGradeNFLWeek(Number(pool.season),week,body.seasonType==='POST'?'POST':'REG',supabase,poolId,{trigger:'commissioner',recordRun:true});
      return NextResponse.json({success:true,result});
    }
    if(body.action==='correct_game'){
      const gameId=String(body.gameId||'');
      const homeScore=Number(body.homeScore),awayScore=Number(body.awayScore);
      if(!gameId||!Number.isInteger(homeScore)||homeScore<0||!Number.isInteger(awayScore)||awayScore<0)return NextResponse.json({error:'Enter valid final scores.'},{status:400});
      const {data:game}=await supabase.from('games').select('id,season,week,home_team,away_team,raw').eq('id',gameId).eq('sport','NFL').eq('season',pool.season).maybeSingle();
      if(!game)return NextResponse.json({error:'Game not found for this league season.'},{status:404});
      const winnerTeam=homeScore===awayScore?null:homeScore>awayScore?game.home_team:game.away_team;
      const correctedAt=new Date().toISOString();
      const {error}=await supabase.from('games').update({home_score:homeScore,away_score:awayScore,winner_team:winnerTeam,status:'FINAL',raw:{...(game.raw||{}),manualOverride:{homeScore,awayScore,winnerTeam,correctedAt,correctedBy:user.id}},updated_at:correctedAt}).eq('id',game.id);
      if(error)throw error;
      const result=await syncAndGradeNFLWeek(Number(game.season),Number(game.week),'REG',supabase,poolId,{trigger:'commissioner',recordRun:true});
      return NextResponse.json({success:true,result});
    }
    return NextResponse.json({error:'Unknown action.'},{status:400});
  }catch(error){console.error('[league-management] action failed',{error:error instanceof Error?error.message:typeof error==='object'?JSON.stringify(error):String(error)});return failure(error);}
}
