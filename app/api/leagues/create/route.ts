import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const TYPES = new Set(['SURVIVOR','PICKEM','BRACKET','PLAYOFF_FANTASY']);
const SPORTS = new Set(['NFL','NHL','NBA']);

function slugify(value:string){
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'league';
}

export async function POST(request:Request){
  try{
    const {user}=await requireUser();
    const admin=createAdminClient();
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

    let organizationId=body.organizationId?String(body.organizationId):'';
    if(!organizationId&&!organizationName){
      const {data:ownedOrg}=await admin.from('organizations').select('id').eq('owner_user_id',user.id).order('created_at').limit(1).maybeSingle();
      organizationId=ownedOrg?.id||'';
    }
    if(organizationId){
      const {data:organization}=await admin.from('organizations').select('id,owner_user_id').eq('id',organizationId).maybeSingle();
      if(!organization) return NextResponse.json({error:'Organization not found.'},{status:404});
      if(organization.owner_user_id!==user.id){
        const {data:membership}=await admin.from('organization_members').select('role,status').eq('organization_id',organizationId).eq('user_id',user.id).maybeSingle();
        if(membership?.status!=='ACTIVE'||!['OWNER','ADMIN','COMMISSIONER'].includes(membership.role)){
          return NextResponse.json({error:'You do not have permission to create a league for this organization.'},{status:403});
        }
      }
    }
    if(!organizationId){
      const orgName=organizationName||`${name} Organization`;
      const slug=`${slugify(orgName)}-${randomBytes(3).toString('hex')}`;
      const {data:org,error:orgError}=await admin.from('organizations').insert({name:orgName,slug,owner_user_id:user.id}).select('id,name').single();
      if(orgError) return NextResponse.json({error:orgError.message},{status:400});
      organizationId=org.id;
      const {error:memberError}=await admin.from('organization_members').insert({organization_id:organizationId,user_id:user.id,role:'OWNER',status:'ACTIVE'});
      if(memberError) return NextResponse.json({error:memberError.message},{status:400});
    }

    const scoringSettings={
      deadline_mode:body.deadlineMode==='SUNDAY_10AM_PT'?'SUNDAY_10AM_PT':'GAME_KICKOFF',
      missed_pick_elimination:body.strictMissedPicks!==false,
    };
    const {data:pool,error:poolError}=await admin.from('pools').insert({
      organization_id:organizationId,name,sport,pool_type:poolType,season,
      entry_fee_cents:entryFeeCents,currency:'CAD',max_entries_per_user:maxEntries,
      max_participants:maxParticipants,
      scoring_settings:scoringSettings,is_active:true,visibility:'INVITE_ONLY',
    }).select('*').single();
    if(poolError) return NextResponse.json({error:poolError.message},{status:400});
    const {error:leagueMemberError}=await admin.from('league_members').insert({pool_id:pool.id,user_id:user.id,role:'COMMISSIONER',status:'ACTIVE'});
    if(leagueMemberError) return NextResponse.json({error:leagueMemberError.message},{status:400});

    const roundCount=poolType==='SURVIVOR'||poolType==='PICKEM'?18:poolType==='PLAYOFF_FANTASY'?4:1;
    const rounds=Array.from({length:roundCount},(_,index)=>({pool_id:pool.id,label:poolType==='PLAYOFF_FANTASY'?['Wild Card','Divisional','Conference Championships','Super Bowl'][index]:`Week ${index+1}`,round_order:index+1}));
    const {error:roundError}=await admin.from('rounds').insert(rounds);
    if(roundError) return NextResponse.json({error:roundError.message},{status:400});

    const inviteCode=randomBytes(4).toString('hex').toUpperCase();
    const codeHash=createHash('sha256').update(inviteCode).digest('hex');
    const {error:inviteError}=await admin.from('league_invitations').insert({pool_id:pool.id,code_hash:codeHash,code_hint:inviteCode.slice(-4),created_by:user.id});
    if(inviteError) return NextResponse.json({error:inviteError.message},{status:400});
    return NextResponse.json({pool,inviteCode},{status:201});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not create league.'},{status:401});
  }
}
