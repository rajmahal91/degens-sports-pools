import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

const TYPES = new Set(['SURVIVOR','PICKEM','BRACKET','PLAYOFF_FANTASY']);
const SPORTS = new Set(['NFL','NHL','NBA']);

export async function POST(request:Request){
  try{
    const {supabase}=await requireUser();
    const body=await request.json();
    const name=String(body.name||'').trim().slice(0,80);
    const organizationName=String(body.organizationName||'').trim().slice(0,80);
    const sport=String(body.sport||'NFL').toUpperCase();
    const poolType=String(body.poolType||'SURVIVOR').toUpperCase();
    const season=Number(body.season||new Date().getUTCFullYear());
    const entryFeeCents=Math.max(0,Math.round(Number(body.entryFee||0)*100));
    const maxEntries=Math.min(100,Math.max(1,Number(body.maxEntries||1)));
    const maxParticipants=Math.min(1000,Math.max(1,Number(body.maxParticipants||1000)));
    if(name.length<2||!SPORTS.has(sport)||!TYPES.has(poolType)||season<2026||season>2100){
      return NextResponse.json({error:'Enter valid league details.'},{status:400});
    }

    const {data,error}=await supabase.rpc('create_league',{
      p_organization_id:body.organizationId?String(body.organizationId):null,
      p_organization_name:organizationName,
      p_name:name,
      p_sport:sport,
      p_pool_type:poolType,
      p_season:season,
      p_entry_fee_cents:entryFeeCents,
      p_max_entries:maxEntries,
      p_max_participants:maxParticipants,
      p_deadline_mode:body.deadlineMode==='SUNDAY_10AM_PT'?'SUNDAY_10AM_PT':'GAME_KICKOFF',
      p_strict_missed_picks:body.strictMissedPicks!==false,
    });
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json(data,{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not create league.'},{status:401});
  }
}
