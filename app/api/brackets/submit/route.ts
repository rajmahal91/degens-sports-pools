import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req:Request){
 const body=await req.json();
 if(!body?.sport||!body?.picks) return NextResponse.json({error:'Missing bracket data.'},{status:400});
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ok:true,demo:true});
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) return NextResponse.json({error:'Sign in required.'},{status:401});
 const rows=Object.entries(body.picks).map(([matchupId,p]:any)=>({user_id:user.id,sport:body.sport,matchup_id:matchupId,predicted_winner:p.winner,predicted_games:p.games}));
 const {error}=await supabase.from('bracket_picks').upsert(rows,{onConflict:'user_id,matchup_id'});
 if(error) return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,count:rows.length});
}
