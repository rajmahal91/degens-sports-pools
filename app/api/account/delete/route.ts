import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request:Request){
  try{
    const {user}=await requireUser();
    const body=await request.json().catch(()=>({}));
    if(body.confirmation!=='DELETE')return NextResponse.json({error:'Type DELETE to confirm account deletion.'},{status:400});
    const admin=createAdminClient();
    const [{count:organizationCount,error:organizationError},{count:poolCount,error:poolError}]=await Promise.all([
      admin.from('organizations').select('id',{count:'exact',head:true}).eq('owner_user_id',user.id),
      admin.from('pools').select('id',{count:'exact',head:true}).eq('created_by',user.id),
    ]);
    if(organizationError)throw organizationError;if(poolError)throw poolError;
    if((organizationCount||0)>0||(poolCount||0)>0)return NextResponse.json({error:'Delete or transfer every league you own before deleting your account. This protects other league members from losing their pool.'},{status:409});
    const anonymizeResults=await Promise.all([
      admin.from('commissioner_audit_log').update({commissioner_id:null}).eq('commissioner_id',user.id),
      admin.from('payments').update({verified_by:null}).eq('verified_by',user.id),
      admin.from('prize_draws').update({drawn_by:null}).eq('drawn_by',user.id),
      admin.from('prize_draws').update({overridden_by:null}).eq('overridden_by',user.id),
    ]);
    const anonymizeError=anonymizeResults.find(result=>result.error)?.error;if(anonymizeError)throw anonymizeError;
    const {error}=await admin.auth.admin.deleteUser(user.id);if(error)throw error;
    return NextResponse.json({deleted:true});
  }catch(error){
    const message=error instanceof Error?error.message:'Could not delete the account.';
    return NextResponse.json({error:message},{status:message==='UNAUTHENTICATED'?401:500});
  }
}
