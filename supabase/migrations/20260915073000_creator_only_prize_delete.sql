alter table public.pools add column if not exists created_by uuid references auth.users(id);

update public.pools p
set created_by = coalesce(
  (
    select lm.user_id
    from public.league_members lm
    where lm.pool_id = p.id and lm.role = 'COMMISSIONER'
    order by lm.joined_at asc
    limit 1
  ),
  (
    select o.owner_user_id
    from public.organizations o
    where o.id = p.organization_id
  )
)
where p.created_by is null;

alter table public.pools alter column created_by set default auth.uid();
alter table public.pools alter column created_by set not null;

create or replace function private.preserve_pool_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'The league creator cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_pool_creator on public.pools;
create trigger preserve_pool_creator
before update of created_by on public.pools
for each row execute function private.preserve_pool_creator();

drop policy if exists "prizes tenant manage" on public.prizes;
drop policy if exists "prizes tenant insert" on public.prizes;
drop policy if exists "prizes tenant update" on public.prizes;
drop policy if exists "prizes creator delete" on public.prizes;

create policy "prizes tenant insert"
on public.prizes for insert
to authenticated
with check ((select private.can_manage_pool(prizes.pool_id)));

create policy "prizes tenant update"
on public.prizes for update
to authenticated
using ((select private.can_manage_pool(prizes.pool_id)))
with check ((select private.can_manage_pool(prizes.pool_id)));

create policy "prizes creator delete"
on public.prizes for delete
to authenticated
using (
  exists (
    select 1
    from public.pools p
    where p.id = prizes.pool_id
      and p.created_by = (select auth.uid())
  )
);
