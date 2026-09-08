import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [{data:profile},{data:pools},{data:entries},{data:payments},{data:games},{data:athletes}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',user.id).single(),
      supabase.from('pools').select('*').order('created_at'),
      supabase.from('entries').select('*').eq('user_id',user.id).order('created_at'),
      supabase.from('payments').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('games').select('*').eq('sport','NFL').order('starts_at').limit(80),
      supabase.from('athletes').select('id,full_name,team_code,position,active').eq('sport','NFL').eq('active',true).limit(1200),
    ]);
    const poolIds=(pools||[]).map(p=>p.id);
    const {data:rounds}=poolIds.length?await supabase.from('rounds').select('*').in('pool_id',poolIds).order('sequence'):({data:[]} as any);
    const entryIds=(entries||[]).map(e=>e.id);
    const [{data:survivor},{data:pickem},{data:fantasy}] = entryIds.length ? await Promise.all([
      supabase.from('survivor_picks').select('*').in('entry_id',entryIds),
      supabase.from('pickem_picks').select('*').in('entry_id',entryIds),
      supabase.from('playoff_fantasy_picks').select('*,athletes(full_name,team_code,position)').in('entry_id',entryIds),
    ]) : [{data:[]},{data:[]},{data:[]}];
    return NextResponse.json({ user:{id:user.id,email:user.email}, profile, pools:pools||[], entries:entries||[], payments:payments||[], games:games||[], rounds:rounds||[], survivor:survivor||[], pickem:pickem||[], fantasy:fantasy||[], athletes:athletes||[] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unauthenticated' }, { status: 401 });
  }
}
