create or replace function public.get_leaderboard_rows(p_pool_id uuid)
returns table (
  entry_id uuid,
  entry_name text,
  entry_status text,
  score numeric,
  secondary_value integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pool_type text;
begin
  if auth.uid() is null or not private.can_access_pool(p_pool_id) then
    raise exception 'Pool not found or access denied.' using errcode = '42501';
  end if;

  select p.pool_type::text
    into v_pool_type
    from public.pools p
   where p.id = p_pool_id;

  if v_pool_type = 'SURVIVOR' then
    return query
      select e.id,
             e.entry_name,
             e.entry_status::text,
             count(sp.id) filter (where sp.result = 'WIN')::numeric,
             min(sp.week) filter (where sp.result = 'LOSS')::integer
        from public.entries e
        left join public.survivor_picks sp on sp.entry_id = e.id
       where e.pool_id = p_pool_id
         and e.payment_status = 'PAID'
       group by e.id, e.entry_name, e.entry_status, e.created_at
       order by (e.entry_status = 'ACTIVE') desc,
                count(sp.id) filter (where sp.result = 'WIN') desc,
                e.entry_name;
  elsif v_pool_type = 'PICKEM' then
    return query
      select e.id,
             e.entry_name,
             e.entry_status::text,
             count(pp.id) filter (where pp.is_correct is true)::numeric,
             count(pp.id) filter (where pp.is_correct is not null)::integer
        from public.entries e
        left join public.pickem_picks pp on pp.entry_id = e.id
       where e.pool_id = p_pool_id
         and e.payment_status = 'PAID'
       group by e.id, e.entry_name, e.entry_status, e.created_at
       order by count(pp.id) filter (where pp.is_correct is true) desc,
                e.entry_name;
  elsif v_pool_type = 'PLAYOFF_FANTASY' then
    return query
      select e.id,
             e.entry_name,
             e.entry_status::text,
             coalesce(sum(fp.fantasy_points), 0)::numeric,
             null::integer
        from public.entries e
        left join public.playoff_fantasy_picks fp on fp.entry_id = e.id
       where e.pool_id = p_pool_id
         and e.payment_status = 'PAID'
       group by e.id, e.entry_name, e.entry_status, e.created_at
       order by coalesce(sum(fp.fantasy_points), 0) desc,
                e.entry_name;
  end if;
end;
$$;

revoke all on function public.get_leaderboard_rows(uuid) from public;
grant execute on function public.get_leaderboard_rows(uuid) to authenticated;
