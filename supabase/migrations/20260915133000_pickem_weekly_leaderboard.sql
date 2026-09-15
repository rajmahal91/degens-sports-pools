create or replace function public.get_pickem_weekly_rows(
  p_pool_id uuid,
  p_week integer
)
returns table (
  entry_id uuid,
  entry_name text,
  weekly_score integer,
  weekly_graded integer,
  total_score integer,
  total_graded integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.can_access_pool(p_pool_id) then
    raise exception 'Pool not found or access denied.' using errcode = '42501';
  end if;

  if p_week not between 1 and 18 then
    raise exception 'Week must be between 1 and 18.' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.pools p
     where p.id = p_pool_id
       and p.pool_type = 'PICKEM'
  ) then
    raise exception 'Pick''em pool not found.' using errcode = '22023';
  end if;

  return query
    select e.id,
           e.entry_name,
           count(pp.id) filter (
             where g.week = p_week and pp.is_correct is true
           )::integer,
           count(pp.id) filter (
             where g.week = p_week and pp.is_correct is not null
           )::integer,
           count(pp.id) filter (where pp.is_correct is true)::integer,
           count(pp.id) filter (where pp.is_correct is not null)::integer
      from public.entries e
      left join public.pickem_picks pp on pp.entry_id = e.id
      left join public.games g on g.id = pp.game_id
     where e.pool_id = p_pool_id
     group by e.id, e.entry_name, e.created_at
     order by count(pp.id) filter (
                where g.week = p_week and pp.is_correct is true
              ) desc,
              e.entry_name;
end;
$$;

revoke all on function public.get_pickem_weekly_rows(uuid, integer) from public;
revoke all on function public.get_pickem_weekly_rows(uuid, integer) from anon;
grant execute on function public.get_pickem_weekly_rows(uuid, integer) to authenticated;
