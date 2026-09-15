create or replace function public.get_survivor_grid_rows(p_pool_id uuid)
returns table (
  entry_id uuid,
  entry_name text,
  entry_status text,
  picks jsonb
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

  if not exists (
    select 1
      from public.pools p
     where p.id = p_pool_id
       and p.pool_type = 'SURVIVOR'
  ) then
    raise exception 'Survivor pool not found.' using errcode = '22023';
  end if;

  return query
    with pool_config as (
      select coalesce(p.scoring_settings->>'deadline_mode', 'GAME_KICKOFF') as deadline_mode
        from public.pools p
       where p.id = p_pool_id
    ),
    game_locks as (
      select g.id,
             g.status,
             case
               when pc.deadline_mode = 'SUNDAY_10AM_PT' then least(
                 g.kickoff_at,
                 coalesce(
                   min(g.kickoff_at) filter (
                     where extract(
                       isodow from g.kickoff_at at time zone 'America/Vancouver'
                     ) = 7
                   ) over (partition by g.season, g.week),
                   g.kickoff_at
                 )
               )
               else g.kickoff_at
             end as lock_at
        from public.games g
        cross join pool_config pc
       where g.sport = 'NFL'
    )
    select e.id,
           e.entry_name,
           e.entry_status::text,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'week', sp.week,
                 'teamCode', case
                   when gl.status <> 'SCHEDULED' or gl.lock_at <= now()
                     then sp.team_code
                   else null
                 end,
                 'locked', gl.status <> 'SCHEDULED' or gl.lock_at <= now(),
                 'result', coalesce(sp.result::text, 'PENDING')
               )
               order by sp.week
             ) filter (where sp.id is not null),
             '[]'::jsonb
           )
      from public.entries e
      left join public.survivor_picks sp on sp.entry_id = e.id
      left join game_locks gl on gl.id = sp.game_id
     where e.pool_id = p_pool_id
     group by e.id, e.entry_name, e.entry_status, e.created_at
     order by (e.entry_status = 'ACTIVE') desc, e.entry_name;
end;
$$;

revoke all on function public.get_survivor_grid_rows(uuid) from public;
revoke all on function public.get_survivor_grid_rows(uuid) from anon;
grant execute on function public.get_survivor_grid_rows(uuid) to authenticated;
