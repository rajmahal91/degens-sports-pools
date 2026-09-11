alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (
    username is null
    or username ~ '^[a-z0-9][a-z0-9._-]{2,23}$'
  );

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requested_username text := lower(trim(new.raw_user_meta_data->>'username'));
begin
  if requested_username !~ '^[a-z0-9][a-z0-9._-]{2,23}$' then
    requested_username := null;
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)),
    requested_username
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
