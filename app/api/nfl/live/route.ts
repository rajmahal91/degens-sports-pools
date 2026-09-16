import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { syncAndGradeNFLWeek } from '@/lib/sports/nfl-operations';

const refreshWeek=unstable_cache(
  async (season:number,week:number)=>syncAndGradeNFLWeek(season,week,'REG',undefined,undefined,{recordRun:false}),
  ['nfl-live-score-refresh'],
  {revalidate:60},
);

export async function GET(request:Request){
  try{
    const {supabase,user}=await requireUser();
    const url=new URL(request.url);
    const season=Number(url.searchParams.get('season'));
    const week=Number(url.searchParams.get('week'));
    const activeWeek=Number(url.searchParams.get('currentWeek')||week);
    if(!Number.isInteger(season)||season<2020||season>2100||!Number.isInteger(week)||week<1||week>22||!Number.isInteger(activeWeek)||activeWeek<1||activeWeek>22){
      return NextResponse.json({error:'A valid NFL season and week are required.'},{status:400});
    }
    const weeks=[...new Set([week,activeWeek,activeWeek>1?activeWeek-1:null].filter((value):value is number=>value!==null))];
    const settled=await Promise.allSettled(weeks.map(targetWeek=>refreshWeek(season,targetWeek)));
    for(const [index,result] of settled.entries()){
      if(result.status==='rejected')console.error('[api/nfl/live] refresh failed',{
        season,
        week:weeks[index],
        error:result.reason instanceof Error?result.reason.message:String(result.reason),
      });
    }
    const sync=Object.fromEntries(weeks.map((targetWeek,index)=>[targetWeek,settled[index].status==='fulfilled'?(settled[index] as PromiseFulfilledResult<unknown>).value:null]));
    const [{data:games,error:gamesError},{data:entries,error:entriesError}]=await Promise.all([
      supabase.from('games').select('*').eq('sport','NFL').eq('season',season).in('week',weeks).order('kickoff_at'),
      supabase.from('entries').select('id,entry_status').eq('user_id',user.id),
    ]);
    if(gamesError)throw gamesError;if(entriesError)throw entriesError;
    const entryIds=(entries||[]).map(entry=>entry.id);
    const {data:picks,error:picksError}=entryIds.length
      ?await supabase.from('survivor_picks').select('entry_id,week,result').in('entry_id',entryIds).in('week',weeks)
      :{data:[],error:null};
    if(picksError)throw picksError;
    return NextResponse.json({games:games||[],entries:entries||[],picks:picks||[],sync},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Live scores could not be refreshed.';
    console.error('[api/nfl/live] request failed',{error:message});
    return NextResponse.json({error:message},{status:message==='UNAUTHENTICATED'?401:500});
  }
}
