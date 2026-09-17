create or replace function public.delete_league(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select p.organization_id
    into v_organization_id
    from public.pools p
   where p.id = p_pool_id
     and (
       p.created_by = v_user_id
       or exists (
         select 1 from public.organizations o
          where o.id = p.organization_id and o.owner_user_id = v_user_id
       )
       or exists (
         select 1 from public.league_members lm
          where lm.pool_id = p.id
            and lm.user_id = v_user_id
            and lm.status = 'ACTIVE'
            and lm.role = 'COMMISSIONER'
       )
     );

  if v_organization_id is null then
    raise exception 'Only the lead commissioner can delete this league.' using errcode = '42501';
  end if;

  delete from public.survivor_picks where entry_id in (select id from public.entries where pool_id = p_pool_id);
  delete from public.pickem_picks where entry_id in (select id from public.entries where pool_id = p_pool_id);
  delete from public.playoff_fantasy_picks where entry_id in (select id from public.entries where pool_id = p_pool_id);
  delete from public.bracket_picks where entry_id in (select id from public.entries where pool_id = p_pool_id);
  delete from public.pick_receipts where pool_id = p_pool_id;
  delete from public.prize_draws where prize_id in (select id from public.prizes where pool_id = p_pool_id);
  delete from public.bracket_matchups where pool_id = p_pool_id;
  delete from public.rounds where pool_id = p_pool_id;
  delete from public.scoring_runs where pool_id = p_pool_id;
  delete from public.entries where pool_id = p_pool_id;
  delete from public.league_members where pool_id = p_pool_id;
  delete from public.league_invitations where pool_id = p_pool_id;
  delete from public.prizes where pool_id = p_pool_id;
  delete from public.commissioner_audit_log where organization_id = v_organization_id and entity_id = p_pool_id;
  delete from public.pools where id = p_pool_id;
end;
$$;

revoke all on function public.delete_league(uuid) from public;
grant execute on function public.delete_league(uuid) to authenticated;
