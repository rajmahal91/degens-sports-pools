import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(req:Request){
 const u=new URL(req.url), sport=u.searchParams.get('sport'), poolId=u.searchParams.get('poolId');
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({matchups:[]});
 const s=await createClient(); let q=s.from('bracket_matchups').select('*').order('round_number').order('conference').order('id');
 if(sport) q=q.eq('sport',sport); if(poolId) q=q.eq('pool_id',poolId);
 const {data,error}=await q; if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({matchups:data||[]});
}
