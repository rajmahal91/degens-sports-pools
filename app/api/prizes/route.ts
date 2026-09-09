import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';

async function manageablePoolIds(admin:ReturnType<typeof createAdminClient>,userId:string){
 const {data:owned}=await admin.from('pools').select('id,organizations!inner(owner_user_id)').eq('organizations.owner_user_id',userId);
 const {data:league}=await admin.from('league_members').select('pool_id').eq('user_id',userId).eq('status','ACTIVE').in('role',['COMMISSIONER','CO_COMMISSIONER']);
 return new Set([...(owned||[]).map((p:any)=>p.id),...(league||[]).map((m:any)=>m.pool_id)]);
}
export async function GET(){
 try{
  const {supabase,user}=await requireUser();const admin=createAdminClient();
  const {data:visiblePools}=await supabase.from('pools').select('id,name,sport,pool_type').order('created_at');
  const poolIds=(visiblePools||[]).map(p=>p.id);if(!poolIds.length)return NextResponse.json({prizes:[],pools:[],canManagePoolIds:[]});
  const canManage=await manageablePoolIds(admin,user.id);
  const {data:prizes,error}=await admin.from('prizes').select('*,prize_draws(id,winner_entry_id,drawn_at,verification_hash,eligible_snapshot)').in('pool_id',poolIds).order('draw_at');if(error)throw error;
  const result=[];
  for(const prize of prizes||[]){
   let q=admin.from('entries').select('id,entry_name,user_id,entry_status,payment_status').eq('pool_id',prize.pool_id).eq('payment_status',prize.eligibility?.payment_status||'PAID');
   if(prize.eligibility?.entry_status)q=q.eq('entry_status',prize.eligibility.entry_status);
   const {data:raw}=await q;let eligible=raw||[];
   if(prize.eligibility?.one_prize_per_entry){const {data:wins}=await admin.from('prize_draws').select('winner_entry_id,prizes!inner(pool_id)').eq('prizes.pool_id',prize.pool_id);const won=new Set((wins||[]).map((x:any)=>x.winner_entry_id));eligible=eligible.filter(e=>!won.has(e.id))}
   result.push({...prize,title:prize.name,scheduled_draw_at:prize.draw_at,week:Number(prize.eligibility?.week)||null,eligible_count:eligible.length,my_eligible_entries:eligible.filter(e=>e.user_id===user.id).map(e=>e.entry_name),eligible_entries:canManage.has(prize.pool_id)?eligible.map(e=>({id:e.id,name:e.entry_name})):undefined});
  }
  return NextResponse.json({prizes:result,pools:visiblePools||[],canManagePoolIds:[...canManage]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load prizes.'},{status:401})}
}
export async function POST(req:Request){
 try{
  const {user}=await requireUser();const admin=createAdminClient();const body=await req.json();
  const poolId=String(body.poolId||''),name=String(body.name||'').trim().slice(0,100),week=Number(body.week),valueDollars=Number(body.valueDollars||0);
  if(!poolId||name.length<2||week<1||week>18)return NextResponse.json({error:'Choose a league, enter a prize name, and select Week 1–18.'},{status:400});
  const canManage=await manageablePoolIds(admin,user.id);if(!canManage.has(poolId))return NextResponse.json({error:'Commissioner access required.'},{status:403});
  const eligibility:any={week,payment_status:'PAID',one_prize_per_entry:body.onePrizePerEntry!==false};if(body.activeOnly!==false)eligibility.entry_status='ACTIVE';
  const {data,error}=await admin.from('prizes').insert({pool_id:poolId,name,description:String(body.description||'').trim().slice(0,300)||null,value_cents:Math.max(0,Math.round(valueDollars*100))||null,draw_at:body.drawAt||null,status:'UPCOMING',eligibility}).select('*').single();
  if(error)throw error;return NextResponse.json({prize:data},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not create prize.'},{status:403})}
}
