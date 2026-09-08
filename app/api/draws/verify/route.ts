import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('id'); if(!id)return NextResponse.json({error:'Draw id required'},{status:400});
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:'Connected mode required'},{status:503});
 const s=await createClient(); const {data:d,error}=await s.from('prize_draws').select('*').eq('id',id).single(); if(error||!d)return NextResponse.json({error:'Draw not found'},{status:404});
 const snapshot=JSON.stringify(d.eligible_snapshot); const calculated=createHash('sha256').update(`${d.id}|${snapshot}|${d.random_value}`).digest('hex');
 return NextResponse.json({drawId:d.id,verified:calculated===d.verification_hash,calculatedHash:calculated,storedHash:d.verification_hash,winnerEntryId:d.winner_entry_id,drawnAt:d.drawn_at});
}
