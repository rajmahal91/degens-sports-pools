import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [
      {data:profile},
      {data:entries},
      {data:payments},
      {data:games},
      {data:athletes},
      {data:leagueMemberships},
      {data:organizationMemberships},
      {data:ownedOrganizations},
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',user.id).single(),
      supabase.from('entries').select('*').eq('user_id',user.id).order('created_at'),
      supabase.from('payments').select('*').eq('user_id',user.id).order('submitted_at',{ascending:false}),
      supabase.from('games').select('*').eq('sport','NFL').order('kickoff_at').limit(400),
      supabase.from('athletes').select('id,name,team_code,position,active').eq('sport','NFL').eq('active',true).limit(1200),
      supabase.from('league_members').select('pool_id').eq('user_id',user.id).eq('status','ACTIVE'),
      supabase.from('organization_members').select('organization_id,role').eq('user_id',user.id).eq('status','ACTIVE').in('role',['OWNER','ADMIN','COMMISSIONER']),
      supabase.from('organizations').select('id').eq('owner_user_id',user.id),
    ]);
    const memberPoolIds=(leagueMemberships||[]).map(m=>m.pool_id);
    const entryPoolIds=(entries||[]).map(e=>e.pool_id);
    const visiblePoolIds=[...new Set([...memberPoolIds,...entryPoolIds])];
    const managedOrganizationIds=[...new Set([
      ...(organizationMemberships||[]).map(m=>m.organization_id),
      ...(ownedOrganizations||[]).map(o=>o.id),
    ])];
    const [{data:memberPools},{data:managedPools}] = await Promise.all([
      visiblePoolIds.length
        ? supabase.from('pools').select('*').in('id',visiblePoolIds).order('created_at')
        : Promise.resolve({data:[]}),
      managedOrganizationIds.length
        ? supabase.from('pools').select('*').in('organization_id',managedOrganizationIds).order('created_at')
        : Promise.resolve({data:[]}),
    ]);
    const pools=[...new Map([...(memberPools||[]),...(managedPools||[])].map(pool=>[pool.id,pool])).values()];
    const poolIds=(pools||[]).map(p=>p.id);
    const {data:rounds}=poolIds.length?await supabase.from('rounds').select('*').in('pool_id',poolIds).order('round_order'):({data:[]} as any);
    const entryIds=(entries||[]).map(e=>e.id);
    const [{data:survivor},{data:pickem},{data:fantasy}] = entryIds.length ? await Promise.all([
      supabase.from('survivor_picks').select('*').in('entry_id',entryIds),
      supabase.from('pickem_picks').select('*').in('entry_id',entryIds),
      supabase.from('playoff_fantasy_picks').select('*,athletes(name,team_code,position)').in('entry_id',entryIds),
    ]) : [{data:[]},{data:[]},{data:[]}];
    const nflGames=games||[];
    const weeks=[...new Set(nflGames.map((game:any)=>Number(game.week)).filter(Boolean))].sort((a,b)=>a-b);
    const sixHoursAgo=Date.now()-(6*60*60*1000);
    let currentWeek=weeks[0]||1;
    for(const week of weeks){
      const weekGames=nflGames.filter((game:any)=>Number(game.week)===week);
      const complete=weekGames.length>0&&weekGames.every((game:any)=>game.status==='FINAL'||game.status==='CANCELLED'||new Date(game.kickoff_at).getTime()<=sixHoursAgo);
      currentWeek=week;
      if(!complete) break;
    }
    return NextResponse.json({ user:{id:user.id,email:user.email}, profile, pools:pools||[], entries:entries||[], payments:payments||[], games:nflGames, rounds:rounds||[], survivor:survivor||[], pickem:pickem||[], fantasy:fantasy||[], athletes:athletes||[], currentWeek });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unauthenticated' }, { status: 401 });
  }
}
