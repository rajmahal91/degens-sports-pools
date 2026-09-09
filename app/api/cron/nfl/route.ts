import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAndGradeNFLWeek } from '@/lib/sports/nfl-operations';

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const admin=createAdminClient();
    const now=new Date();
    const from=new Date(now.getTime()-4*24*60*60*1000).toISOString();
    const to=new Date(now.getTime()+8*24*60*60*1000).toISOString();
    const {data,error}=await admin.from('games').select('season,week').eq('sport','NFL').gte('kickoff_at',from).lte('kickoff_at',to);
    if(error)throw error;
    const weeks=[...new Map((data||[]).map(row=>[`${row.season}-${row.week}`,row])).values()];
    const results=[];
    for(const row of weeks)results.push(await syncAndGradeNFLWeek(Number(row.season),Number(row.week)));
    return NextResponse.json({ranAt:now.toISOString(),results});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'NFL automation failed'},{status:500});}
}
