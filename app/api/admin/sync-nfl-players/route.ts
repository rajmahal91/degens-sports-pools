import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getNFLProvider } from '@/lib/sports/provider';

function authorized(request:Request){const s=process.env.CRON_SECRET;return !!s&&request.headers.get('authorization')===`Bearer ${s}`}
export async function POST(request:Request){
 if(!authorized(request)) return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const provider=getNFLProvider(); const players=await provider.players(); const supabase=createAdminClient();
  const rows=players.map(p=>({id:p.athleteId,sport:'NFL',full_name:p.fullName,team_code:p.teamCode,position:p.position,active:p.active}));
  const {error}=await supabase.from('athletes').upsert(rows,{onConflict:'id'}); if(error) throw error;
  return NextResponse.json({provider:provider.name,synced:rows.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Player sync failed'},{status:500})}
}
