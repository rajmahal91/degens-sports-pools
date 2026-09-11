create or replace function private.can_access_pool(target_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.pools p
    join public.organizations o on o.id = p.organization_id
    where p.id = target_pool_id
      and (
        o.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.organization_members om
          where om.organization_id = o.id
            and om.user_id = (select auth.uid())
            and om.status = 'ACTIVE'
            and om.role in ('OWNER', 'ADMIN', 'COMMISSIONER')
        )
        or exists (
          select 1
          from public.league_members lm
          where lm.pool_id = p.id
            and lm.user_id = (select auth.uid())
            and lm.status = 'ACTIVE'
        )
        or exists (
          select 1
          from public.entries e
          where e.pool_id = p.id
            and e.user_id = (select auth.uid())
        )
      )
  );
$function$;
