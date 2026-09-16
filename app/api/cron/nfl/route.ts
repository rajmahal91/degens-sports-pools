import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAndGradeNFLWeek } from '@/lib/sports/nfl-operations';

export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const admin=createAdminClient();
    const now=new Date();
    const from=new Date(now.getTime()-10*24*60*60*1000).toISOString();
    const to=new Date(now.getTime()+8*24*60*60*1000).toISOString();
    const {data,error}=await admin.from('games').select('season,week,raw').eq('sport','NFL').gte('kickoff_at',from).lte('kickoff_at',to);
    if(error)throw error;
    const weeks=[...new Map((data||[]).map(row=>[`${row.season}-${row.week}-${row.raw?.seasonType||'REG'}`,{season:row.season,week:row.week,seasonType:row.raw?.seasonType==='POST'?'POST' as const:'REG' as const}])).values()];
    const results=[];const failures=[];
    for(const row of weeks){
      try{
        results.push(await syncAndGradeNFLWeek(Number(row.season),Number(row.week),row.seasonType,undefined,undefined,{trigger:'cron',recordRun:true}));
      }catch(error){
        const failure={season:row.season,week:row.week,error:error instanceof Error?error.message:'NFL automation failed'};
        failures.push(failure);
        console.error('[cron/nfl] week failed',failure);
      }
    }
    if(!weeks.length)return NextResponse.json({error:'No NFL weeks were found in the scoring window.'},{status:503});
    return NextResponse.json({ranAt:now.toISOString(),ok:failures.length===0,results,failures},{status:results.length?200:503});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'NFL automation failed'},{status:500});}
}
