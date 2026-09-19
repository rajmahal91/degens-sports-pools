-- Native APNs/FCM registrations for the Capacitor iOS and Android apps.

create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  token text not null unique,
  app_id text not null default 'com.sportssyndicate.fantasy',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists native_push_tokens_user_idx on public.native_push_tokens(user_id) where disabled_at is null;

alter table public.native_push_tokens enable row level security;

drop policy if exists "users manage own native push tokens" on public.native_push_tokens;
create policy "users manage own native push tokens" on public.native_push_tokens
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.native_push_tokens from anon;
grant select,insert,update,delete on table public.native_push_tokens to authenticated;
grant all on table public.native_push_tokens to service_role;
