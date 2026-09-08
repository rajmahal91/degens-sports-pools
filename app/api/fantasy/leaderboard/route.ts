import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(req:Request){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({rows:[{rank:1,name:'Rouge91',round:87.6,total:281.4},{rank:2,name:'HMundi',round:93.1,total:277.8},{rank:3,name:'SunnyS',round:81.2,total:269.5}]});
 const supabase=await createClient();
 const poolId=new URL(req.url).searchParams.get('poolId');
 let q=supabase.from('fantasy_leaderboard').select('*').order('fantasy_points',{ascending:false});
 if(poolId)q=q.eq('pool_id',poolId);
 const {data,error}=await q;
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({rows:(data||[]).map((r:any,i:number)=>({rank:i+1,name:r.entry_name,total:Number(r.fantasy_points)}))});
}
